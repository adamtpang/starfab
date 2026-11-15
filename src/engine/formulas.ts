// Closed-form capacity calculator. Same math as docs/factory-model.md
// section 5 and docs/tech-spec.md section 4. This is the analytical check
// that sits beside the discrete-time simulator.

import type { ClosedFormResult, CrewId, Plant, Station, StationId } from "../types";

export function scheduledHoursFor(plant: Plant, crew?: CrewId): number {
  const shift = plant.shifts.find((s) => s.crew === crew) ?? plant.shifts[0];
  return shift ? shift.scheduledHours : 0;
}

export function plantDemandPerHour(plant: Plant): number {
  return plant.annualDemandKits / plant.calendarDays / plant.hoursPerDay;
}

// te_i = c_i / (n_i * e_i * a_i). Infinity when the station can never run.
export function effectiveProcessSeconds(s: Station): number {
  return s.cycleTimeSeconds / (s.parallelUnits * s.performance * s.availability);
}

// Constraint rule. factory-model.md section 5 defines the constraint as the
// station with the lowest stand-alone good-unit rate,
// good_rate_i = P * (3600 / te_i) * y_i, upstream station on a tie. In the
// symmetric default plant every station ties, so the answer is S1, which is
// what fixture F1 requires. (Ranking by the compounded out_i would always
// pick the last station, because scrap only ever shrinks the flow.)
export function findConstraintIndex(stations: Station[]): number {
  let best = 0;
  let bestRate = Infinity;
  stations.forEach((s, i) => {
    const rate = (3600 / effectiveProcessSeconds(s)) * s.firstPassYield;
    if (rate < bestRate) {
      bestRate = rate;
      best = i;
    }
  });
  return best;
}

export function computeClosedForm(plant: Plant, crew?: CrewId): ClosedFormResult {
  const H = scheduledHoursFor(plant, crew);
  const P = plant.parallelLines;
  const D = plantDemandPerHour(plant);

  const teSeconds = {} as Record<StationId, number>;
  const stationOutflowGoodPerHour = {} as Record<StationId, number>;

  let inflow = 0;
  let startRatePerHour = 0;
  let inflowToLast = 0;
  let rty = 1;

  plant.stations.forEach((s, i) => {
    const te = effectiveProcessSeconds(s);
    const cap = (P * 3600) / te;
    if (i === 0) {
      inflow = cap;
      startRatePerHour = cap;
    }
    if (i === plant.stations.length - 1) inflowToLast = inflow;
    const out = Math.min(inflow, cap) * s.firstPassYield;
    teSeconds[s.id] = te;
    stationOutflowGoodPerHour[s.id] = out;
    rty *= s.firstPassYield;
    inflow = out;
  });

  const goodPerHour = inflow;
  const constraint = plant.stations[findConstraintIndex(plant.stations)];
  const unitsStarted = startRatePerHour * H;
  const unitsGood = goodPerHour * H;
  const plannedUnitsAtTakt = H * D;

  return {
    teSeconds,
    startRatePerHour,
    stationOutflowGoodPerHour,
    unitsStarted,
    unitsCompleted: inflowToLast * H,
    unitsGood,
    unitsScrap: unitsStarted - unitsGood,
    rty,
    lineTaktSeconds: 3600 / (D / P),
    plantDemandPerHour: D,
    plannedUnitsAtTakt,
    aheadOrBehind: unitsGood - plannedUnitsAtTakt,
    bottleneckStationId: constraint.id,
    runtimeHoursConstraint: H * constraint.availability,
    downtimeHoursConstraint: H * (1 - constraint.availability),
  };
}
