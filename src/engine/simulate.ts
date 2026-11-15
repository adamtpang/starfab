// Deterministic, seeded, discrete-time shift simulator.
// Tick rules: docs/tech-spec.md section 5.1. One tick is one second (A15).
// No buffers between stations (A14), scrap does not rework (A11), units
// still on the line at the end of the shift are WIP (A19), and S1 starts a
// new unit whenever it is idle and up (A20).

import type {
  CrewId,
  DowntimeEvent,
  DowntimeReason,
  OeeParts,
  Plant,
  SimResult,
  StationId,
  StationStats,
} from "../types";
import { DOWNTIME_REASONS } from "../types";
import { assignReasons, buildLineEvents } from "./downtime";
import { computeClosedForm, findConstraintIndex, scheduledHoursFor } from "./formulas";
import { lineStream } from "./rng";

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
  let wipSum = 0;
  let rawEvents: DowntimeEvent[] = [];

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
    let lineStarted = 0;
    let lineLeft = 0; // units that left the line as good or scrap

    // Move a finished unit from station i into an idle, up, empty machine
    // at station i + 1. It begins processing on the next tick, because the
    // downstream station has already been handled in this tick.
    const tryTransfer = (i: number, m: Machine, t: number): boolean => {
      const next = machines[i + 1];
      for (let v = 0; v < next.length; v++) {
        if (!next[v].hasUnit && down[i + 1][v][t] === 0) {
          next[v].hasUnit = true;
          next[v].finished = false;
          next[v].remaining = processSeconds[i + 1];
          m.hasUnit = false;
          m.finished = false;
          return true;
        }
      }
      return false;
    };

    for (let t = 0; t < scheduledSeconds; t++) {
      // Starts (A20): an S1 machine that came out of the previous tick idle
      // and is up now starts a unit and works on it during this tick.
      const first = machines[0];
      for (let u = 0; u < first.length; u++) {
        if (!first[u].hasUnit && down[0][u][t] === 0) {
          first[u].hasUnit = true;
          first[u].finished = false;
          first[u].remaining = processSeconds[0];
          lineStarted++;
        }
      }

      // Downstream first, so a space frees before upstream tries to push.
      for (let i = lastIndex; i >= 0; i--) {
        const tally = tallies[i];
        const station = stations[i];
        for (let u = 0; u < machines[i].length; u++) {
          const m = machines[i][u];
          if (down[i][u][t] === 1) {
            // Down: no processing, no transfer. A unit on the machine waits.
            tally.downtimeSeconds++;
            continue;
          }
          if (m.hasUnit && !m.finished) {
            tally.busySeconds++;
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
                lineLeft++;
                m.hasUnit = false;
              } else {
                tally.outflowGood++;
                if (i === lastIndex) {
                  unitsGood++;
                  lineLeft++;
                  m.hasUnit = false;
                } else if (!tryTransfer(i, m, t)) {
                  m.finished = true; // blocked, holds the finished unit
                }
              }
            }
          } else if (m.finished) {
            if (!tryTransfer(i, m, t)) tally.blockedSeconds++;
            else tally.idleSeconds++;
          } else {
            tally.idleSeconds++;
          }
        }
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
    wipEnd: unitsStarted - unitsGood - unitsScrap,
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
  };
}
