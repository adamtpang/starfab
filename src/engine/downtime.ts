// Seeded downtime event calendar (A17, A18). See docs/tech-spec.md
// section 5.3. Every machine gets an exact downtime budget of
// (1 - a_i) * scheduledSeconds, split into events of about 900 seconds.

import type { DowntimeEvent, DowntimeReason, Station } from "../types";

// A18: reasons cycle in the order breakdown, changeover, material_wait,
// quality_hold, with 4, 3, 2, 1 of each in every 10 events (40/30/20/10).
// ASSUMPTION A18, not plant data.
export const REASON_CYCLE: DowntimeReason[] = [
  "breakdown",
  "changeover",
  "material_wait",
  "quality_hold",
  "breakdown",
  "changeover",
  "material_wait",
  "breakdown",
  "changeover",
  "breakdown",
];

const MAX_PLACEMENT_TRIES = 100;

interface Interval {
  start: number;
  duration: number;
}

// Integer durations that sum exactly to the rounded budget.
export function eventDurations(
  availability: number,
  scheduledSeconds: number,
  meanEventSeconds: number,
): number[] {
  const budget = Math.min(
    scheduledSeconds,
    Math.round((1 - availability) * scheduledSeconds),
  );
  if (!(budget > 0)) return [];
  const mean = Math.max(1, Math.round(meanEventSeconds));
  const n = Math.max(1, Math.round(budget / mean));
  const durations: number[] = [];
  for (let k = 0; k < n - 1; k++) durations.push(mean);
  durations.push(budget - (n - 1) * mean);
  return durations;
}

function overlaps(placed: Interval[], start: number, duration: number): boolean {
  return placed.some(
    (p) => start < p.start + p.duration && p.start < start + duration,
  );
}

// Earliest start where `duration` fits between already placed intervals,
// or -1 if no single gap is large enough.
function earliestGap(placed: Interval[], duration: number, horizon: number): number {
  const sorted = [...placed].sort((x, y) => x.start - y.start);
  let cursor = 0;
  for (const p of sorted) {
    if (p.start - cursor >= duration) return cursor;
    cursor = Math.max(cursor, p.start + p.duration);
  }
  return horizon - cursor >= duration ? cursor : -1;
}

// Place one machine's events with the line RNG. No overlap, all inside
// [0, scheduledSeconds). The budget always stays exact.
export function placeMachineEvents(
  durations: number[],
  scheduledSeconds: number,
  rng: () => number,
): Interval[] {
  const placed: Interval[] = [];
  for (const duration of durations) {
    let start = -1;
    for (let attempt = 0; attempt < MAX_PLACEMENT_TRIES; attempt++) {
      const candidate = Math.floor(rng() * (scheduledSeconds - duration + 1));
      if (!overlaps(placed, candidate, duration)) {
        start = candidate;
        break;
      }
    }
    if (start < 0) start = earliestGap(placed, duration, scheduledSeconds);
    if (start < 0) {
      // No single gap fits. Slide the existing events together from t = 0
      // (keeping their order) so the leftover time is one gap at the end,
      // then attach this event directly after them. The total budget is at
      // most the shift length, so this always fits.
      placed.sort((x, y) => x.start - y.start);
      let cursor = 0;
      for (const p of placed) {
        p.start = cursor;
        cursor += p.duration;
      }
      start = cursor;
    }
    placed.push({ start, duration });
  }
  return placed.sort((x, y) => x.start - y.start);
}

// Events for one line, without reasons yet. Draw order is stations in line
// order, then parallel unit index, as required by tech-spec section 5.2.
export function buildLineEvents(
  stations: Station[],
  lineId: number,
  scheduledSeconds: number,
  meanEventSeconds: number,
  rng: () => number,
): DowntimeEvent[] {
  const events: DowntimeEvent[] = [];
  for (const station of stations) {
    for (let unitIndex = 0; unitIndex < station.parallelUnits; unitIndex++) {
      const durations = eventDurations(
        station.availability,
        scheduledSeconds,
        meanEventSeconds,
      );
      for (const p of placeMachineEvents(durations, scheduledSeconds, rng)) {
        events.push({
          id: "",
          lineId,
          stationId: station.id,
          unitIndex,
          reason: "breakdown",
          startSecond: p.start,
          durationSeconds: p.duration,
        });
      }
    }
  }
  return events;
}

// Sort the whole calendar by start time (line, station, unit as stable tie
// breaks) and label reasons by cycling, so the Pareto is stable.
export function assignReasons(
  events: DowntimeEvent[],
  stationOrder: string[],
): DowntimeEvent[] {
  const sorted = [...events].sort(
    (x, y) =>
      x.startSecond - y.startSecond ||
      x.lineId - y.lineId ||
      stationOrder.indexOf(x.stationId) - stationOrder.indexOf(y.stationId) ||
      x.unitIndex - y.unitIndex,
  );
  return sorted.map((e, i) => ({
    ...e,
    id: `D${i + 1}`,
    reason: REASON_CYCLE[i % REASON_CYCLE.length],
  }));
}
