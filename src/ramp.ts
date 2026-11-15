// Ramp test: rerun the shift across a range of one lever and find where the
// line stops holding takt. Every point is a full seeded simulation, so the
// result is deterministic for a given plant, levers and seed.

import { applyLevers } from "./applyLevers";
import { simulateShift } from "./engine/simulate";
import type { CrewId, Plant, StationId, WhatIfLevers } from "./types";

export type RampVariable = "speed" | "buffer" | "availability" | "lines";

export interface RampSpec {
  id: RampVariable;
  label: string;
  unit: string;
  // Values in the order they are drawn, left to right, from hardest on the
  // line to easiest.
  values: number[];
  toLevers: (value: number) => WhatIfLevers;
  format: (value: number) => string;
}

export const RAMPS: Record<RampVariable, RampSpec> = {
  speed: {
    id: "speed",
    label: "Line speed",
    unit: "cycle-time multiplier",
    values: [1.5, 1.3, 1.15, 1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3],
    toLevers: (v) => ({ cycleTimeMultiplier: v }),
    format: (v) => `x${v.toFixed(2)}`,
  },
  buffer: {
    id: "buffer",
    label: "Buffer size",
    unit: "units between stations",
    values: [0, 1, 2, 3, 5, 8, 12, 16, 20],
    toLevers: (v) => ({ bufferCapacity: v }),
    format: (v) => String(Math.ceil(v)), // whole units, rounded up at a break
  },
  availability: {
    id: "availability",
    label: "Availability",
    unit: "every station",
    values: [0.8, 0.84, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 1],
    toLevers: (v) => ({ availability: v }),
    format: (v) => v.toFixed(2),
  },
  lines: {
    id: "lines",
    label: "Parallel lines",
    unit: "lines",
    values: [1, 2, 3, 4, 5, 6, 8, 10, 12],
    toLevers: (v) => ({ parallelLines: v }),
    format: (v) => String(Math.ceil(v)), // whole lines, rounded up at a break
  },
};

export interface RampPoint {
  value: number;
  unitsGood: number;
  plannedUnitsAtTakt: number;
  gap: number; // unitsGood - plannedUnitsAtTakt
  bottleneckStationId: StationId;
}

export interface RampResult {
  variable: RampVariable;
  points: RampPoint[];
  // "holds": every point meets takt. "breaks": no point does.
  // "crosses": the line holds takt from breakValue onward (to the right).
  verdict: "holds" | "breaks" | "crosses";
  // Interpolated lever value where good units equal planned units.
  breakValue: number | null;
  // The point closest to takt, for the "breaks" verdict.
  closest: RampPoint;
}

export function runRamp(
  seedPlant: Plant,
  levers: WhatIfLevers,
  variable: RampVariable,
  crew?: CrewId,
): RampResult {
  const spec = RAMPS[variable];
  const points: RampPoint[] = spec.values.map((value) => {
    const plant = applyLevers(seedPlant, { ...levers, ...spec.toLevers(value) });
    const sim = simulateShift(plant, { crew, trace: false });
    return {
      value,
      unitsGood: sim.unitsGood,
      plannedUnitsAtTakt: sim.plannedUnitsAtTakt,
      gap: sim.aheadOrBehind,
      bottleneckStationId: sim.bottleneckStationId,
    };
  });

  let breakValue: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.gap < 0 && b.gap >= 0) {
      const f = a.gap / (a.gap - b.gap);
      breakValue = a.value + (b.value - a.value) * f;
      break;
    }
  }
  const closest = points.reduce((best, p) => (p.gap > best.gap ? p : best), points[0]);
  const verdict =
    breakValue !== null ? "crosses" : points.every((p) => p.gap >= 0) ? "holds" : "breaks";

  return { variable, points, verdict, breakValue, closest };
}
