// Closed-form capacity calculator. Same math as docs/factory-model.md
// section 5 and docs/tech-spec.md section 4. This is the analytical check
// that sits beside the discrete-time simulator.

import type { ClosedFormResult, CrewId, Plant, Station, StationId } from "../types";
import { flowTopology } from "./topology";

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

  // Forward pass in list order. A station with nothing feeding it runs at
  // its own capacity. A join can only build as fast as its slowest stream.
  const { inputs, sources } = flowTopology(plant.stations);
  const out: number[] = [];
  const supplyPerHour = plant.supply
    ? (P * plant.supply.kitsPerDelivery * 3600) / plant.supply.intervalSeconds
    : Infinity;
  let startRatePerHour = 0;
  let inflowToLast = 0;
  let mergedPerHour = 0;
  let rty = 1;

  plant.stations.forEach((s, i) => {
    const te = effectiveProcessSeconds(s);
    const cap = (P * 3600) / te;
    // A station that starts units can go no faster than its share of the
    // material delivered (split evenly between the starting stations).
    const inflow = sources.includes(i)
      ? Math.min(cap, supplyPerHour / sources.length)
      : Math.min(...inputs[i].map((a) => out[a]));
    if (sources.includes(i)) startRatePerHour += inflow;
    if (i === plant.stations.length - 1) inflowToLast = inflow;
    const processed = Math.min(inflow, cap);
    mergedPerHour += processed * (inputs[i].length > 1 ? inputs[i].length - 1 : 0);
    out[i] = processed * s.firstPassYield;
    teSeconds[s.id] = te;
    stationOutflowGoodPerHour[s.id] = out[i];
    rty *= s.firstPassYield;
  });

  const goodPerHour = out[out.length - 1] ?? 0;
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
    // Everything started that did not end as a good unit or get absorbed at
    // a join. In a straight line this is the spec rule, started minus good.
    unitsScrap: unitsStarted - unitsGood - mergedPerHour * H,
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
