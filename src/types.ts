// Shared types for the starfab teaching model.
// Shapes follow docs/tech-spec.md section 3. Assumption ids (A1 to A20) are
// defined in docs/factory-model.md and docs/tech-spec.md.

export type Source =
  | { kind: "assumption"; id: string; note: string }
  | { kind: "public"; title: string; url: string; date: string; excerpt?: string }
  | { kind: "derived"; from: string[]; formula: string };

export type StationId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
export type CrewId = "A" | "B" | "C" | "D";
export type DowntimeReason =
  | "breakdown"
  | "changeover"
  | "material_wait"
  | "quality_hold";

export interface Station {
  id: StationId;
  name: string;
  cycleTimeSeconds: number; // A9
  parallelUnits: number; // A10
  operators: number; // A10
  firstPassYield: number; // A11, 0 to 1
  availability: number; // A12, 0 to 1
  performance: number; // A13, 0 to 1
  sources: Record<string, Source>;
}

export interface ShiftPattern {
  crew: CrewId;
  startClock: string; // "05:00" or "17:00", from the posting
  endClock: string; // "17:30" or "05:30", from the posting
  daysNote: string;
  scheduledHours: number; // A2
  mealBreakMinutes: number; // A2
  sources?: Record<string, Source>;
}

export interface Plant {
  name: "starfab teaching model";
  unofficialDisclaimer: "Unofficial fan or learning project, not affiliated with SpaceX.";
  annualDemandKits: number; // sourced 10,000,000 plus A4
  calendarDays: number; // A6, 365
  hoursPerDay: number; // A3 / A6, 24
  parallelLines: number; // A7
  rngSeed: number; // A16, default 1
  meanDowntimeEventSeconds: number; // A17, default 900
  bufferCapacity?: number; // units between adjacent stations, A14 default 0
  stations: Station[];
  shifts: ShiftPattern[];
  sources?: Record<string, Source>;
}

export interface WhatIfLevers {
  parallelLines?: number;
  annualDemandKits?: number;
  cycleTimeMultiplier?: number;
  firstPassYield?: number;
  availability?: number;
  scheduledHours?: number;
  seed?: number;
  bufferCapacity?: number;
  cycleTimeSeconds?: Partial<Record<StationId, number>>;
  firstPassYieldByStation?: Partial<Record<StationId, number>>;
  availabilityByStation?: Partial<Record<StationId, number>>;
}

export interface ClosedFormResult {
  teSeconds: Record<StationId, number>;
  startRatePerHour: number;
  stationOutflowGoodPerHour: Record<StationId, number>;
  unitsStarted: number;
  unitsCompleted: number;
  unitsGood: number;
  unitsScrap: number;
  rty: number;
  lineTaktSeconds: number;
  plantDemandPerHour: number;
  plannedUnitsAtTakt: number;
  aheadOrBehind: number;
  bottleneckStationId: StationId;
  runtimeHoursConstraint: number;
  downtimeHoursConstraint: number;
}

export interface DowntimeEvent {
  id: string;
  lineId: number;
  stationId: StationId;
  unitIndex: number; // which parallel unit at that station, 0-based
  reason: DowntimeReason;
  startSecond: number; // inclusive, in [0, H)
  durationSeconds: number;
}

export interface StationStats {
  outflowGood: number;
  outflowTotal: number;
  scrap: number;
  uptimeSeconds: number;
  downtimeSeconds: number;
  busySeconds: number;
  blockedSeconds: number;
  idleSeconds: number;
  utilization: number; // busySeconds / scheduledSeconds
  observedAvailability: number; // (scheduledSeconds - downtimeSeconds) / scheduledSeconds
}

export interface OeeParts {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface SimResult {
  analytical: ClosedFormResult;
  scheduledSeconds: number;
  unitsStarted: number;
  unitsCompleted: number;
  unitsGood: number;
  unitsScrap: number;
  wipEnd: number;
  wipAverage: number;
  rtyTheoretical: number;
  yieldObserved: number; // unitsGood / unitsCompleted, or 0 if none completed
  yieldFromStarts: number; // unitsGood / unitsStarted, or 0 if none started
  lineTaktSeconds: number;
  plannedUnitsAtTakt: number;
  aheadOrBehind: number; // unitsGood - plannedUnitsAtTakt
  bottleneckStationId: StationId;
  throughputGoodPerHour: number;
  oee: OeeParts;
  stationStats: Record<StationId, StationStats>;
  downtimeEvents: DowntimeEvent[];
  downtimeByReason: Record<
    DowntimeReason,
    { seconds: number; events: number; share: number }
  >;
  // Display data, beyond the tech-spec shape.
  goodByHour: number[]; // good units at pack-out per scheduled hour, all lines
  buffers: {
    capacity: number;
    gaps: { afterStationId: StationId; average: number; fullShare: number }[];
  };
  stateTimeline: StateTimeline;
}

export type MachineState = "down" | "blocked" | "busy" | "idle";

// Dominant state per time bin for each station on one line.
export interface StateTimeline {
  lineId: number;
  binSeconds: number;
  rows: Record<StationId, MachineState[]>;
}

export const DOWNTIME_REASONS: DowntimeReason[] = [
  "breakdown",
  "changeover",
  "material_wait",
  "quality_hold",
];
