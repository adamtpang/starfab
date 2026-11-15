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
  feeds?: StationId; // station this one feeds, default: the next in the list
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
  name: string;
  unofficialDisclaimer: "Unofficial fan or learning project, not affiliated with SpaceX.";
  annualDemandKits: number; // sourced 10,000,000 plus A4
  calendarDays: number; // A6, 365
  hoursPerDay: number; // A3 / A6, 24
  parallelLines: number; // A7
  rngSeed: number; // A16, default 1
  meanDowntimeEventSeconds: number; // A17, default 900
  bufferCapacity?: number; // units between adjacent stations, A14 default 0
  transferSeconds?: number; // travel time between stations, default 0
  supply?: SupplyPlan; // supplier deliveries, default: material never runs out
  hall?: HallInfo;
  demandInfo?: DemandInfo;
  stations: Station[];
  shifts: ShiftPattern[];
  sources?: Record<string, Source>;
}

// Supplier deliveries to each line. Starting a unit takes one kit of stock.
export interface SupplyPlan {
  kitsPerDelivery: number;
  intervalSeconds: number; // time between deliveries, first one after one interval
  stockCapacity: number; // a delivery that does not fit waits at the dock
  initialStock: number;
}

// Which fictional hall this plant is, and what it makes.
export interface HallInfo {
  id: string;
  label: string;
  product: string;
  unitNoun: string;
  unitNounPlural: string;
  blurb: string;
}

// Where the demand figure comes from, in words, with links and a date.
export interface DemandInfo {
  statement: string;
  date: string;
  links: { title: string; url: string }[];
  assumptionIds: string[];
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
  unitsMerged: number; // parts absorbed at joins, 0 in a straight line
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
  stateTimeline: StateTimeline; // line 1
  stateTimelines: StateTimeline[]; // every line
  flowByMinute: { started: number[]; good: number[]; scrap: number[] }; // all lines
  transferSeconds: number;
  supply: {
    deliveries: number;
    starvedSeconds: number; // machine seconds free and up with no material
    heldSeconds: number; // seconds a delivery waited at a full dock
    stockAverage: number;
  } | null;
  trace: UnitTrace | null; // every unit's path, or null when tracing is off
}

// How a stay on a machine ended.
export const VISIT_OUTCOME = {
  moved: 0, // went on to a buffer or the next machine
  scrap: 1, // failed and was removed
  exit: 2, // left the last station as a good unit
  absorbed: 3, // went on, then became part of another unit at a join
  open: 4, // still on the machine when the shift ended
} as const;

// Every unit's path, as column tables. Times are seconds from shift start.
export interface UnitTrace {
  // One row per stay on a machine. done and leave are -1 while still open.
  visits: {
    unit: number[];
    line: number[];
    station: number[]; // index into plant.stations
    machine: number[];
    enter: number[];
    done: number[];
    leave: number[];
    outcome: number[];
  };
  // One row per stay in the buffer after a station. to is -1 while open.
  waits: {
    unit: number[];
    line: number[];
    afterStation: number[];
    from: number[];
    to: number[];
  };
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
