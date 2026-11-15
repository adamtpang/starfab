// Deterministic, seeded, discrete-time shift simulator.
// Tick rules: docs/tech-spec.md section 5.1. One tick is one second (A15).
// No buffers between stations (A14), scrap does not rework (A11), units
// still on the line at the end of the shift are WIP (A19), and S1 starts a
// new unit whenever it is idle and up (A20).

import type {
  CrewId,
  DowntimeEvent,
  DowntimeReason,
  MachineState,
  OeeParts,
  Plant,
  SimResult,
  StateTimeline,
  StationId,
  StationStats,
} from "../types";
import { DOWNTIME_REASONS } from "../types";
import { assignReasons, buildLineEvents } from "./downtime";
import { computeClosedForm, findConstraintIndex, scheduledHoursFor } from "./formulas";
import { lineStream } from "./rng";
import { flowTopology } from "./topology";

const TIMELINE_BIN_SECONDS = 60;
const DOWN = 0;
const BLOCKED = 1;
const BUSY = 2;
const IDLE = 3;
const STATE_NAMES: MachineState[] = ["down", "blocked", "busy", "idle"];

// The state that filled most of a bin. Ties go to the earlier, more severe
// state (down, then blocked, then busy, then idle).
function dominantState(counts: Uint16Array, bin: number): MachineState {
  let best = IDLE;
  let bestCount = -1;
  for (let state = 0; state < 4; state++) {
    const c = counts[bin * 4 + state];
    if (c > bestCount) {
      bestCount = c;
      best = state;
    }
  }
  return STATE_NAMES[best];
}

export type ScriptedYield = (stationId: StationId, completionIndex: number) => boolean;

export interface SimOptions {
  crew?: CrewId;
  // "bernoulli" (default) draws yield from the seeded line RNG.
  // "scripted" is for tests only: every unit is good unless scriptedYield
  // says otherwise. completionIndex is 1-based, per station, per line.
  yieldMode?: "bernoulli" | "scripted";
  scriptedYield?: ScriptedYield;
}

interface Machine {
  hasUnit: boolean;
  finished: boolean; // true when a finished unit is waiting to move on (blocked)
  remaining: number;
}

interface Tally {
  outflowGood: number;
  outflowTotal: number;
  scrap: number;
  downtimeSeconds: number;
  busySeconds: number;
  blockedSeconds: number;
  idleSeconds: number;
}

export function simulateShift(plant: Plant, options: SimOptions = {}): SimResult {
  const analytical = computeClosedForm(plant, options.crew);
  const stations = plant.stations;
  const lastIndex = stations.length - 1;
  const { next, inputs, sources, order } = flowTopology(stations);
  const P = plant.parallelLines;
  const hours = scheduledHoursFor(plant, options.crew);
  const scheduledSeconds = Math.max(0, Math.round(hours * 3600));
  const scripted = options.yieldMode === "scripted";

  const tallies: Tally[] = stations.map(() => ({
    outflowGood: 0,
    outflowTotal: 0,
    scrap: 0,
    downtimeSeconds: 0,
    busySeconds: 0,
    blockedSeconds: 0,
    idleSeconds: 0,
  }));

  let unitsStarted = 0;
  let unitsGood = 0;
  let unitsScrap = 0;
  let unitsMerged = 0; // parts absorbed into another part at a join
  let wipSum = 0;
  let rawEvents: DowntimeEvent[] = [];
  const bufferCapacity = Math.max(0, Math.floor(plant.bufferCapacity ?? 0));
  const bufferUnitSeconds: number[] = new Array(Math.max(0, stations.length - 1)).fill(0);
  const bufferFullSeconds: number[] = new Array(Math.max(0, stations.length - 1)).fill(0);

  // Display data. Good units per scheduled hour (all lines), and a per-minute
  // state record for line 1 only, so the dashboard can draw a state timeline.
  const goodByHour: number[] = new Array(Math.ceil(scheduledSeconds / 3600)).fill(0);
  const bins = Math.ceil(scheduledSeconds / TIMELINE_BIN_SECONDS);
  const stateCounts = Array.from({ length: P }, () =>
    stations.map(() => new Uint16Array(bins * 4)),
  );
  const record = (line: number, i: number, t: number, state: number) => {
    stateCounts[line][i][Math.floor(t / TIMELINE_BIN_SECONDS) * 4 + state]++;
  };
  // Units started, finished good, and scrapped in each minute, all lines.
  const flowByMinute = {
    started: new Array<number>(bins).fill(0),
    good: new Array<number>(bins).fill(0),
    scrap: new Array<number>(bins).fill(0),
  };

  for (let line = 0; line < P; line++) {
    // One stream per line: downtime placement first, then yield draws.
    const rng = lineStream(plant.rngSeed, line);
    const lineEvents = buildLineEvents(
      stations,
      line,
      scheduledSeconds,
      plant.meanDowntimeEventSeconds,
      rng,
    );
    rawEvents = rawEvents.concat(lineEvents);

    // Per-machine down mask: down[i][u][t] is 1 when an event covers tick t.
    const down: Uint8Array[][] = stations.map((s) =>
      Array.from({ length: s.parallelUnits }, () => new Uint8Array(scheduledSeconds)),
    );
    for (const e of lineEvents) {
      const i = stations.findIndex((s) => s.id === e.stationId);
      down[i][e.unitIndex].fill(1, e.startSecond, e.startSecond + e.durationSeconds);
    }

    const machines: Machine[][] = stations.map((s) =>
      Array.from({ length: s.parallelUnits }, () => ({
        hasUnit: false,
        finished: false,
        remaining: 0,
      })),
    );
    const processSeconds = stations.map((s) => s.cycleTimeSeconds / s.performance);
    const completions = stations.map(() => 0);
    // buffers[i] is the number of units waiting between station i and i + 1.
    const buffers: number[] = new Array(Math.max(0, stations.length - 1)).fill(0);
    let lineStarted = 0;
    let lineLeft = 0; // units that left the line as good or scrap

    // A join starts a unit when it has one part ready from every stream
    // that feeds it. A part is ready if it sits in that stream's buffer, or
    // is held finished on an upstream machine that is up.
    const tryJoinStart = (j: number, t: number) => {
      for (let v = 0; v < machines[j].length; v++) {
        const target = machines[j][v];
        if (target.hasUnit || down[j][v][t] === 1) continue;
        const holders: (Machine | null)[] = [];
        let ready = true;
        for (const a of inputs[j]) {
          if (buffers[a] > 0) {
            holders.push(null);
            continue;
          }
          const u = machines[a].findIndex((x, k) => x.hasUnit && x.finished && down[a][k][t] === 0);
          if (u < 0) {
            ready = false;
            break;
          }
          holders.push(machines[a][u]);
        }
        if (!ready) return;
        inputs[j].forEach((a, k) => {
          const holder = holders[k];
          if (holder) {
            holder.hasUnit = false;
            holder.finished = false;
          } else {
            buffers[a]--;
          }
        });
        target.hasUnit = true;
        target.finished = false;
        target.remaining = processSeconds[j];
        // Several parts became one unit.
        const absorbed = inputs[j].length - 1;
        lineLeft += absorbed;
        unitsMerged += absorbed;
      }
    };

    // Move a finished unit on from station i. It begins processing on the
    // next tick, because the downstream station has already been handled in
    // this tick.
    const tryTransfer = (i: number, m: Machine, t: number): boolean => {
      const j = next[i];
      if (inputs[j].length > 1) {
        // Feeding a join: wait in the buffer if there is room, otherwise on
        // the machine, then see whether the join can now start.
        if (buffers[i] < bufferCapacity) {
          buffers[i]++;
          m.hasUnit = false;
          m.finished = false;
        } else {
          m.finished = true;
        }
        tryJoinStart(j, t);
        return !m.hasUnit;
      }
      const target = machines[j];
      for (let v = 0; v < target.length; v++) {
        if (!target[v].hasUnit && down[j][v][t] === 0) {
          target[v].hasUnit = true;
          target[v].finished = false;
          target[v].remaining = processSeconds[j];
          m.hasUnit = false;
          m.finished = false;
          return true;
        }
      }
      // No machine can take it. Park it in the buffer after station i if
      // there is room (finite buffer, capacity 0 by default, A14).
      if (buffers[i] < bufferCapacity) {
        buffers[i]++;
        m.hasUnit = false;
        m.finished = false;
        return true;
      }
      return false;
    };

    for (let t = 0; t < scheduledSeconds; t++) {
      // Starts (A20): a machine at a station with nothing feeding it, that
      // came out of the previous tick idle and is up now, starts a unit and
      // works on it during this tick. In a straight line that is S1 only.
      for (const src of sources) {
        const first = machines[src];
        for (let u = 0; u < first.length; u++) {
          if (!first[u].hasUnit && down[src][u][t] === 0) {
            first[u].hasUnit = true;
            first[u].finished = false;
            first[u].remaining = processSeconds[src];
            lineStarted++;
            flowByMinute.started[Math.floor(t / TIMELINE_BIN_SECONDS)]++;
          }
        }
      }

      // Downstream first, so a space frees before upstream tries to push.
      for (const i of order) {
        const tally = tallies[i];
        const station = stations[i];
        for (let u = 0; u < machines[i].length; u++) {
          const m = machines[i][u];
          if (down[i][u][t] === 1) {
            // Down: no processing, no transfer. A unit on the machine waits.
            tally.downtimeSeconds++;
            record(line, i, t, DOWN);
            continue;
          }
          if (m.hasUnit && !m.finished) {
            tally.busySeconds++;
            record(line, i, t, BUSY);
            m.remaining -= 1;
            if (m.remaining <= 0) {
              completions[i]++;
              tally.outflowTotal++;
              const good = scripted
                ? options.scriptedYield
                  ? options.scriptedYield(station.id, completions[i])
                  : true
                : rng() < station.firstPassYield;
              if (!good) {
                tally.scrap++;
                unitsScrap++;
                flowByMinute.scrap[Math.floor(t / TIMELINE_BIN_SECONDS)]++;
                lineLeft++;
                m.hasUnit = false;
              } else {
                tally.outflowGood++;
                if (i === lastIndex) {
                  unitsGood++;
                  goodByHour[Math.floor(t / 3600)]++;
                  flowByMinute.good[Math.floor(t / TIMELINE_BIN_SECONDS)]++;
                  lineLeft++;
                  m.hasUnit = false;
                } else if (!tryTransfer(i, m, t)) {
                  m.finished = true; // blocked, holds the finished unit
                }
              }
            }
          } else if (m.finished) {
            if (!tryTransfer(i, m, t)) {
              tally.blockedSeconds++;
              record(line, i, t, BLOCKED);
            } else {
              tally.idleSeconds++;
              record(line, i, t, IDLE);
            }
          } else {
            tally.idleSeconds++;
            record(line, i, t, IDLE);
          }
          // An empty, up machine pulls the next unit from the buffer in
          // front of it. Like a direct transfer, work begins on the next tick.
          if (!m.hasUnit && inputs[i].length === 1 && buffers[inputs[i][0]] > 0) {
            buffers[inputs[i][0]]--;
            m.hasUnit = true;
            m.finished = false;
            m.remaining = processSeconds[i];
          } else if (!m.hasUnit && inputs[i].length > 1) {
            tryJoinStart(i, t);
          }
        }
      }

      for (let g = 0; g < buffers.length; g++) {
        bufferUnitSeconds[g] += buffers[g];
        if (bufferCapacity > 0 && buffers[g] >= bufferCapacity) bufferFullSeconds[g]++;
      }
      wipSum += lineStarted - lineLeft;
    }

    unitsStarted += lineStarted;
  }

  const downtimeEvents = assignReasons(
    rawEvents,
    stations.map((s) => s.id),
  );

  const stationStats = {} as Record<StationId, StationStats>;
  stations.forEach((s, i) => {
    const tally = tallies[i];
    const machineSeconds = P * s.parallelUnits * scheduledSeconds;
    stationStats[s.id] = {
      ...tally,
      uptimeSeconds: machineSeconds - tally.downtimeSeconds,
      utilization: machineSeconds > 0 ? tally.busySeconds / machineSeconds : 0,
      observedAvailability:
        machineSeconds > 0 ? (machineSeconds - tally.downtimeSeconds) / machineSeconds : 0,
    };
  });

  const downtimeByReason = {} as Record<
    DowntimeReason,
    { seconds: number; events: number; share: number }
  >;
  for (const reason of DOWNTIME_REASONS) {
    downtimeByReason[reason] = { seconds: 0, events: 0, share: 0 };
  }
  let totalDowntime = 0;
  for (const e of downtimeEvents) {
    downtimeByReason[e.reason].seconds += e.durationSeconds;
    downtimeByReason[e.reason].events += 1;
    totalDowntime += e.durationSeconds;
  }
  for (const reason of DOWNTIME_REASONS) {
    downtimeByReason[reason].share =
      totalDowntime > 0 ? downtimeByReason[reason].seconds / totalDowntime : 0;
  }

  const stateTimelines: StateTimeline[] = stateCounts.map((perStation, line) => ({
    lineId: line,
    binSeconds: TIMELINE_BIN_SECONDS,
    rows: Object.fromEntries(
      stations.map((s, i) => [
        s.id,
        Array.from({ length: bins }, (_, b) => dominantState(perStation[i], b)),
      ]),
    ) as StateTimeline["rows"],
  }));

  const unitsCompleted = tallies[lastIndex].outflowTotal;
  const yieldObserved = unitsCompleted > 0 ? unitsGood / unitsCompleted : 0;

  // Constraint: same rule as the closed form (see findConstraintIndex).
  const constraintIndex = findConstraintIndex(stations);
  const constraint = stations[constraintIndex];
  const constraintStats = stationStats[constraint.id];
  const constraintMachineSeconds = P * constraint.parallelUnits * scheduledSeconds;
  const oeeAvailability =
    constraintMachineSeconds > 0
      ? 1 - constraintStats.downtimeSeconds / constraintMachineSeconds
      : 0;
  const oeePerformance =
    constraintStats.uptimeSeconds > 0
      ? (unitsCompleted * constraint.cycleTimeSeconds) / constraintStats.uptimeSeconds
      : 0;
  const oee: OeeParts = {
    availability: oeeAvailability,
    performance: oeePerformance,
    quality: yieldObserved,
    oee: oeeAvailability * oeePerformance * yieldObserved,
  };

  const simHours = scheduledSeconds / 3600;

  return {
    analytical,
    scheduledSeconds,
    unitsStarted,
    unitsCompleted,
    unitsGood,
    unitsScrap,
    wipEnd: unitsStarted - unitsGood - unitsScrap - unitsMerged,
    unitsMerged,
    // Mean over ticks of the plant-wide count of units on the lines.
    wipAverage: scheduledSeconds > 0 ? wipSum / scheduledSeconds : 0,
    rtyTheoretical: stations.reduce((acc, s) => acc * s.firstPassYield, 1),
    yieldObserved,
    yieldFromStarts: unitsStarted > 0 ? unitsGood / unitsStarted : 0,
    lineTaktSeconds: analytical.lineTaktSeconds,
    plannedUnitsAtTakt: analytical.plannedUnitsAtTakt,
    aheadOrBehind: unitsGood - analytical.plannedUnitsAtTakt,
    bottleneckStationId: constraint.id,
    throughputGoodPerHour: simHours > 0 ? unitsGood / simHours : 0,
    oee,
    stationStats,
    downtimeEvents,
    downtimeByReason,
    goodByHour,
    buffers: {
      capacity: bufferCapacity,
      gaps: bufferUnitSeconds.map((unitSeconds, g) => ({
        afterStationId: stations[g].id,
        // Averages are per line, over the whole shift.
        average: P * scheduledSeconds > 0 ? unitSeconds / (P * scheduledSeconds) : 0,
        fullShare: P * scheduledSeconds > 0 ? bufferFullSeconds[g] / (P * scheduledSeconds) : 0,
      })),
    },
    stateTimeline: stateTimelines[0],
    stateTimelines,
    flowByMinute,
  };
}
