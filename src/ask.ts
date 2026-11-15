// Ask the twin, rule-based. This is not an AI model. It recognises a fixed
// set of questions, turns each into a change to the levers (or a ramp, or a
// lookup), runs the simulator, and reports that run. A question it does not
// recognise gets a plain "not understood", never a guess.

import { applyLevers, sanitizeLevers } from "./applyLevers";
import { simulateShift } from "./engine/simulate";
import { RAMPS, runRamp, type RampVariable } from "./ramp";
import type { CrewId, Plant, SimResult, Station, StationId, WhatIfLevers } from "./types";

export interface TwinAnswer {
  understood: boolean;
  title: string; // what was run or looked up, in words
  lines: string[]; // the result, one fact per line
  change: WhatIfLevers | null; // levers added on top of the current ones
  run: string; // which run the numbers come from
}

export const ASK_EXAMPLES = [
  "What is the bottleneck?",
  "What if {second} loses a tool?",
  "What if {last} is 20% slower?",
  "Add a line",
  "How many lines to hold takt?",
  "What if availability is 95%?",
  "Where is it blocked most?",
];

const int = (n: number) => Math.round(n).toLocaleString("en-US");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${int(Math.abs(n))}`;

function findStation(q: string, plant: Plant): Station | undefined {
  const byId = q.match(/\bs([1-6])\b/);
  if (byId) return plant.stations.find((s) => s.id === `S${byId[1]}`);
  // Match on any word of a station's name, or the first five letters of it,
  // so "litho" finds Lithography and "test" finds Wafer test.
  return plant.stations.find((s) =>
    s.name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 4)
      .some((word) => q.includes(word) || q.includes(word.slice(0, 5))),
  );
}

// A share written as "95%", "0.95" or "95".
function share(q: string): number | null {
  const m = q.match(/(\d+(?:\.\d+)?)\s*(%|percent)?/);
  if (!m) return null;
  const value = Number(m[1]);
  return m[2] || value > 1 ? value / 100 : value;
}

function percent(q: string): number | null {
  const m = q.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
  return m ? Number(m[1]) : null;
}

function merge(base: WhatIfLevers, change: WhatIfLevers): WhatIfLevers {
  return {
    ...base,
    ...change,
    cycleTimeSeconds: { ...base.cycleTimeSeconds, ...change.cycleTimeSeconds },
    firstPassYieldByStation: { ...base.firstPassYieldByStation, ...change.firstPassYieldByStation },
    availabilityByStation: { ...base.availabilityByStation, ...change.availabilityByStation },
    parallelUnitsByStation: { ...base.parallelUnitsByStation, ...change.parallelUnitsByStation },
  };
}

function stationName(plant: Plant, id: StationId): string {
  const s = plant.stations.find((x) => x.id === id);
  return s ? `${s.id} ${s.name}` : id;
}

function runLabel(seed: Plant, plant: Plant): string {
  return `${seed.hall?.label ?? "This hall"}, seed ${plant.rngSeed}, one ${plant.shifts[0]?.scheduledHours ?? 12} hour shift, everything else as the levers are set now.`;
}

export function askTwin(
  question: string,
  seed: Plant,
  levers: WhatIfLevers,
  crew?: CrewId,
): TwinAnswer {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  const plant = applyLevers(seed, levers);
  const units = plant.hall?.unitNounPlural ?? "units";
  const station = findStation(q, plant);
  const now = (): SimResult => simulateShift(plant, { crew, trace: false });
  const run = runLabel(seed, plant);

  const notUnderstood = (): TwinAnswer => ({
    understood: false,
    title: "Not understood",
    lines: [
      "I could not turn that into a run of the simulator, so there is no answer. This box is rule-based and only knows a fixed set of questions.",
      "It understands: the bottleneck, where blocking or scrap is worst, how many lines or how much speed holds takt, and what-ifs about tools, lines, cycle time, availability, yield, buffers, demand and shift hours.",
    ],
    change: null,
    run: "No run was made.",
  });
  if (!q) return notUnderstood();

  // What-if: build a lever change, then compare two runs.
  const compare = (title: string, change: WhatIfLevers): TwinAnswer => {
    const merged = merge(levers, change);
    const { notes } = sanitizeLevers(merged);
    const nextPlant = applyLevers(seed, merged);
    const before = now();
    const after = simulateShift(nextPlant, { crew, trace: false });
    const delta = after.unitsGood - before.unitsGood;
    const pct = before.unitsGood > 0 ? ` (${signed((delta / before.unitsGood) * 100)}%)` : "";
    const lines = [
      `Good ${units}: ${int(before.unitsGood)} now, ${int(after.unitsGood)} with the change, ${signed(delta)}${pct}.`,
      `Against takt: ${signed(before.aheadOrBehind)} now, ${signed(after.aheadOrBehind)} with the change. ${
        after.aheadOrBehind >= 0 ? "The line would hold takt." : "The line would still be behind."
      }`,
      before.bottleneckStationId === after.bottleneckStationId
        ? `The bottleneck stays at ${stationName(nextPlant, after.bottleneckStationId)}.`
        : `The bottleneck moves from ${stationName(plant, before.bottleneckStationId)} to ${stationName(nextPlant, after.bottleneckStationId)}.`,
      ...notes,
    ];
    return { understood: true, title, lines, change, run: `Two runs compared. ${run}` };
  };

  // Ramp questions: "how many lines to hold takt".
  const ramp = (variable: RampVariable): TwinAnswer => {
    const spec = RAMPS[variable];
    const result = runRamp(seed, levers, variable, crew);
    const label = spec.label.toLowerCase();
    const lines =
      result.verdict === "crosses" && result.breakValue !== null
        ? [`The line starts holding takt at ${label} ${spec.format(result.breakValue)} (${spec.unit}).`]
        : result.verdict === "holds"
          ? [`The line holds takt across the whole range of ${label} that was tried.`]
          : [
              `No ${label} from ${spec.format(spec.values[0])} to ${spec.format(spec.values[spec.values.length - 1])} reaches takt.`,
              `The best case, ${spec.format(result.closest.value)}, is still ${int(-result.closest.gap)} ${units} short.`,
            ];
    return {
      understood: true,
      title: `Ramp of ${label} until the line holds takt`,
      lines,
      change: null,
      run: `${result.points.length} runs, one per value of ${label}. ${run}`,
    };
  };

  const isWhatIf = /what if|suppose|if |add|remove|lose|gain|another|extra|more|fewer|less|slower|faster|double|halve|set /.test(q);

  // Lookups on the current run.
  if (/bottleneck|constraint|limiting|slowest/.test(q) && !isWhatIf) {
    const r = now();
    const b = plant.stations.find((s) => s.id === r.bottleneckStationId) ?? plant.stations[0];
    return {
      understood: true,
      title: "The bottleneck right now",
      lines: [
        `${b.id} ${b.name}. It has the lowest stand-alone rate of good ${units} (capacity times yield), with the upstream station winning a tie.`,
        `It was busy ${(r.stationStats[b.id].utilization * 100).toFixed(1)}% of the shift and made ${int(r.stationStats[b.id].outflowGood)} good ${units}.`,
      ],
      change: null,
      run: `One run. ${run}`,
    };
  }
  if (/how many lines|lines? (to|would|do|does)/.test(q) && /takt|keep up|meet|hold|demand/.test(q)) return ramp("lines");
  if (/how (fast|much faster|quick)|what (speed|cycle)/.test(q)) return ramp("speed");
  if (/(how (much|big|large)|what) buffer/.test(q)) return ramp("buffer");
  if (/(what|how much|how high).*(availab|uptime)/.test(q) && /takt|keep up|meet|hold|demand/.test(q)) {
    return ramp("availability");
  }
  if (/block/.test(q) && !isWhatIf) {
    const r = now();
    const worst = [...plant.stations].sort(
      (a, b) => r.stationStats[b.id].blockedSeconds - r.stationStats[a.id].blockedSeconds,
    )[0];
    const minutes = r.stationStats[worst.id].blockedSeconds / 60;
    return {
      understood: true,
      title: "Where blocking is worst",
      lines:
        minutes > 0
          ? [
              `${worst.id} ${worst.name}: ${int(minutes)} machine minutes spent finished and waiting for room downstream.`,
              "Blocking shows up upstream of whatever is slow or stopped, so look at the stations after it.",
            ]
          : ["No station was blocked in this run."],
      change: null,
      run: `One run. ${run}`,
    };
  }
  if (/scrap/.test(q) && !isWhatIf) {
    const r = now();
    const worst = [...plant.stations].sort((a, b) => r.stationStats[b.id].scrap - r.stationStats[a.id].scrap)[0];
    return {
      understood: true,
      title: "Where scrap is highest",
      lines: [
        `${worst.id} ${worst.name} scrapped ${int(r.stationStats[worst.id].scrap)} of the ${int(r.unitsScrap)} ${units} scrapped in the shift.`,
      ],
      change: null,
      run: `One run. ${run}`,
    };
  }

  // What-ifs.
  const loses = /lose|loses|losing|remove|without|one (less|fewer)|minus|goes down|breaks/.test(q);
  const gains = /add|adds|gain|gains|another|extra|one more|plus/.test(q);
  if (/tool|machine/.test(q) && (loses || gains)) {
    if (!station) {
      return {
        understood: true,
        title: "Which station?",
        lines: ["Name the station, by id (S2) or by name, and I will run it. For example: what if S2 loses a tool."],
        change: null,
        run: "No run was made.",
      };
    }
    const next = station.parallelUnits + (gains && !loses ? 1 : -1);
    if (next < 1) {
      return {
        understood: true,
        title: `${station.id} ${station.name} has only one machine`,
        lines: ["Taking it away would stop the line completely, so there is nothing to compare. Try lowering its availability instead."],
        change: null,
        run: "No run was made.",
      };
    }
    return compare(`${station.id} ${station.name} with ${next} ${next === 1 ? "machine" : "machines"} per line, not ${station.parallelUnits}`, {
      parallelUnitsByStation: { [station.id]: next },
    });
  }
  if (/\bline/.test(q) && (loses || gains || /\d+ lines?/.test(q))) {
    const exact = q.match(/(\d+) lines?/);
    const next = exact ? Number(exact[1]) : plant.parallelLines + (gains && !loses ? 1 : -1);
    return compare(`${next} ${next === 1 ? "line" : "lines"}, not ${plant.parallelLines}`, { parallelLines: next });
  }
  if (/slower|faster/.test(q)) {
    const p = percent(q);
    if (p === null) return notUnderstood();
    const factor = /faster/.test(q) ? 1 - p / 100 : 1 + p / 100;
    if (station) {
      const cycle = Number((station.cycleTimeSeconds * factor).toFixed(3));
      return compare(`${station.id} ${station.name} cycle ${cycle} s, not ${station.cycleTimeSeconds} s`, {
        cycleTimeSeconds: { [station.id]: cycle },
      });
    }
    const multiplier = Number(((levers.cycleTimeMultiplier ?? 1) * factor).toFixed(4));
    return compare(`every cycle time ${p}% ${/faster/.test(q) ? "faster" : "slower"}`, { cycleTimeMultiplier: multiplier });
  }
  if (/availab|uptime/.test(q)) {
    const value = share(q.replace(/s[1-6]\b/, ""));
    if (value === null) return notUnderstood();
    return station
      ? compare(`${station.id} ${station.name} availability ${value}`, { availabilityByStation: { [station.id]: value } })
      : compare(`availability ${value} at every station`, { availability: value });
  }
  if (/yield/.test(q)) {
    const value = share(q.replace(/s[1-6]\b/, ""));
    if (value === null) return notUnderstood();
    return station
      ? compare(`${station.id} ${station.name} yield ${value}`, { firstPassYieldByStation: { [station.id]: value } })
      : compare(`yield ${value} at every station`, { firstPassYield: value });
  }
  if (/buffer/.test(q)) {
    const m = q.match(/(\d+)/);
    if (!m) return notUnderstood();
    return compare(`room for ${m[1]} ${units} between stations`, { bufferCapacity: Number(m[1]) });
  }
  if (/demand/.test(q)) {
    const p = percent(q);
    let next: number | null = null;
    if (/double/.test(q)) next = plant.annualDemandKits * 2;
    else if (/halve|half/.test(q)) next = plant.annualDemandKits / 2;
    else if (p !== null && /up|rise|grow|more|increase|higher/.test(q)) next = plant.annualDemandKits * (1 + p / 100);
    else if (p !== null && /down|drop|fall|less|decrease|lower/.test(q)) next = plant.annualDemandKits * (1 - p / 100);
    else {
      const m = q.replace(/,/g, "").match(/(\d{4,})/);
      if (m) next = Number(m[1]);
    }
    if (next === null) return notUnderstood();
    return compare(`demand of ${int(next)} ${units} a year, not ${int(plant.annualDemandKits)}`, {
      annualDemandKits: Math.round(next),
    });
  }
  if (/hour/.test(q)) {
    const m = q.match(/(\d+(?:\.\d+)?)\s*hours?/);
    if (!m) return notUnderstood();
    return compare(`a ${m[1]} hour shift`, { scheduledHours: Number(m[1]) });
  }
  return notUnderstood();
}
