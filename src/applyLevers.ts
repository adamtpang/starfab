// What-if levers. docs/tech-spec.md section 7. Invalid values are clamped
// (never passed through), and each clamp produces a short visible note.

import type { Plant, StationId, WhatIfLevers } from "./types";

export const LEVER_LIMITS = {
  parallelLines: { min: 1, max: 12 },
  annualDemandKits: { min: 1, max: 1_000_000_000 },
  cycleTimeMultiplier: { min: 0.25, max: 3 },
  firstPassYield: { min: 0, max: 1 },
  availability: { min: 0, max: 1 },
  scheduledHours: { min: 1, max: 16 },
  seed: { min: 0, max: 4294967295 },
  bufferCapacity: { min: 0, max: 20 },
  stationCycleTimeSeconds: { min: 1, max: 3600 },
} as const;

export interface SanitizedLevers {
  levers: WhatIfLevers;
  notes: string[];
}

function clamp(
  label: string,
  value: number | undefined,
  min: number,
  max: number,
  notes: string[],
  integer = false,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) {
    notes.push(`${label} is not a number, so the seed default is used.`);
    return undefined;
  }
  let v = integer ? Math.round(value) : value;
  if (integer && v !== value) notes.push(`${label} was rounded to ${v}.`);
  if (v < min) {
    notes.push(`${label} must be at least ${min}. Clamped from ${value} to ${min}.`);
    v = min;
  } else if (v > max) {
    notes.push(`${label} must be at most ${max}. Clamped from ${value} to ${max}.`);
    v = max;
  }
  return v;
}

function clampMap(
  label: string,
  map: Partial<Record<StationId, number>> | undefined,
  min: number,
  max: number,
  notes: string[],
): Partial<Record<StationId, number>> | undefined {
  if (!map) return undefined;
  const out: Partial<Record<StationId, number>> = {};
  for (const id of Object.keys(map) as StationId[]) {
    const v = clamp(`${id} ${label}`, map[id], min, max, notes);
    if (v !== undefined) out[id] = v;
  }
  return out;
}

export function sanitizeLevers(levers: WhatIfLevers): SanitizedLevers {
  const notes: string[] = [];
  const L = LEVER_LIMITS;
  const clean: WhatIfLevers = {
    parallelLines: clamp("Parallel lines", levers.parallelLines, L.parallelLines.min, L.parallelLines.max, notes, true),
    annualDemandKits: clamp("Annual demand", levers.annualDemandKits, L.annualDemandKits.min, L.annualDemandKits.max, notes),
    cycleTimeMultiplier: clamp("Cycle-time multiplier", levers.cycleTimeMultiplier, L.cycleTimeMultiplier.min, L.cycleTimeMultiplier.max, notes),
    firstPassYield: clamp("First-pass yield", levers.firstPassYield, L.firstPassYield.min, L.firstPassYield.max, notes),
    availability: clamp("Availability", levers.availability, L.availability.min, L.availability.max, notes),
    scheduledHours: clamp("Scheduled hours", levers.scheduledHours, L.scheduledHours.min, L.scheduledHours.max, notes),
    seed: clamp("Seed", levers.seed, L.seed.min, L.seed.max, notes, true),
    bufferCapacity: clamp("Buffer size", levers.bufferCapacity, L.bufferCapacity.min, L.bufferCapacity.max, notes, true),
    cycleTimeSeconds: clampMap("cycle time", levers.cycleTimeSeconds, L.stationCycleTimeSeconds.min, L.stationCycleTimeSeconds.max, notes),
    firstPassYieldByStation: clampMap("yield", levers.firstPassYieldByStation, 0, 1, notes),
    availabilityByStation: clampMap("availability", levers.availabilityByStation, 0, 1, notes),
  };
  return { levers: clean, notes };
}

// Returns a new Plant. The seed plant is never mutated. Global yield,
// availability, and the cycle-time multiplier apply to every station unless
// a per-station override is set (the override wins).
export function applyLevers(plant: Plant, levers: WhatIfLevers): Plant {
  const { levers: l } = sanitizeLevers(levers);
  return {
    ...plant,
    parallelLines: l.parallelLines ?? plant.parallelLines,
    annualDemandKits: l.annualDemandKits ?? plant.annualDemandKits,
    rngSeed: l.seed ?? plant.rngSeed,
    bufferCapacity: l.bufferCapacity ?? plant.bufferCapacity ?? 0,
    stations: plant.stations.map((s) => ({
      ...s,
      cycleTimeSeconds:
        l.cycleTimeSeconds?.[s.id] ?? s.cycleTimeSeconds * (l.cycleTimeMultiplier ?? 1),
      firstPassYield:
        l.firstPassYieldByStation?.[s.id] ?? l.firstPassYield ?? s.firstPassYield,
      availability: l.availabilityByStation?.[s.id] ?? l.availability ?? s.availability,
    })),
    shifts: plant.shifts.map((sh) => ({
      ...sh,
      scheduledHours: l.scheduledHours ?? sh.scheduledHours,
    })),
  };
}
