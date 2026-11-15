// Engine tests. Fixtures F1, F2, F3 and the default-plant invariants come
// from docs/tech-spec.md sections 4, 5.2, 5.3, 5.6, 5.7, and 5.8.

import { describe, expect, it } from "vitest";
import { applyLevers, sanitizeLevers } from "../applyLevers";
import { FAB_PLANT, SEED_PLANT } from "../plant";
import { runRamp } from "../ramp";
import type { Plant, Station, StationId } from "../types";
import { eventDurations, placeMachineEvents } from "./downtime";
import { computeClosedForm } from "./formulas";
import { mulberry32 } from "./rng";
import { simulateShift } from "./simulate";

const IDS: StationId[] = ["S1", "S2", "S3", "S4", "S5", "S6"];

describe("seed plant", () => {
  it("has four lines, six stations, four crews, and the exact disclaimer", () => {
    expect(SEED_PLANT.parallelLines).toBe(4);
    expect(SEED_PLANT.stations.map((s) => s.id)).toEqual(IDS);
    expect(SEED_PLANT.shifts.map((s) => s.crew)).toEqual(["A", "B", "C", "D"]);
    expect(SEED_PLANT.unofficialDisclaimer).toBe(
      "Unofficial fan or learning project, not affiliated with SpaceX.",
    );
  });

  it("gives every numeric station field a source", () => {
    for (const s of SEED_PLANT.stations) {
      for (const [key, value] of Object.entries(s)) {
        if (typeof value === "number") expect(s.sources[key]).toBeDefined();
      }
    }
  });
});

describe("F1 closed form, default plant", () => {
  const r = computeClosedForm(SEED_PLANT);
  const D = 10000000 / 365 / 24;

  it("matches the exact worked expressions", () => {
    for (const id of IDS) {
      expect(r.teSeconds[id]).toBeCloseTo(12 / (1 * 0.95 * 0.9), 8);
      expect(3600 / r.teSeconds[id]).toBeCloseTo(256.5, 8);
    }
    expect(r.rty).toBeCloseTo(0.97 ** 6, 8);
    expect(r.stationOutflowGoodPerHour.S6 / 4).toBeCloseTo(256.5 * 0.97 ** 6, 8);
    expect(r.stationOutflowGoodPerHour.S6).toBeCloseTo(4 * 256.5 * 0.97 ** 6, 8);
    expect(r.unitsGood).toBeCloseTo(12 * 4 * 256.5 * 0.97 ** 6, 8);
    expect(r.unitsStarted).toBeCloseTo(12 * 4 * 256.5, 8);
    expect(r.unitsCompleted).toBeCloseTo(12 * 4 * 256.5 * 0.97 ** 5, 8);
    expect(r.unitsScrap).toBeCloseTo(r.unitsStarted - r.unitsGood, 8);
    expect(r.plantDemandPerHour).toBeCloseTo(D, 8);
    expect(r.lineTaktSeconds).toBeCloseTo(3600 / (D / 4), 8);
    expect(r.plannedUnitsAtTakt).toBeCloseTo(12 * D, 8);
    expect(r.runtimeHoursConstraint).toBeCloseTo(12 * 0.9, 8);
    expect(r.downtimeHoursConstraint).toBeCloseTo(12 * 0.1, 8);
  });

  it("is behind takt, with the upstream tie-break bottleneck S1", () => {
    expect(r.aheadOrBehind).toBeLessThan(0);
    expect(r.bottleneckStationId).toBe("S1");
  });
});

describe("closed form lever cases", () => {
  const base = computeClosedForm(SEED_PLANT);

  it("availability 1 and yield 1 give te = 12 / 0.95 and more good units", () => {
    const r = computeClosedForm(applyLevers(SEED_PLANT, { availability: 1, firstPassYield: 1 }));
    for (const id of IDS) expect(r.teSeconds[id]).toBeCloseTo(12 / 0.95, 8);
    expect(r.stationOutflowGoodPerHour.S6).toBeGreaterThan(base.stationOutflowGoodPerHour.S6);
  });

  it("six lines widen line takt and leave planned units unchanged", () => {
    const r = computeClosedForm(applyLevers(SEED_PLANT, { parallelLines: 6 }));
    expect(r.lineTaktSeconds).toBeGreaterThan(base.lineTaktSeconds);
    expect(r.plannedUnitsAtTakt).toBeCloseTo(base.plannedUnitsAtTakt, 8);
  });

  it("lower demand lowers planned units and improves ahead or behind", () => {
    const r = computeClosedForm(applyLevers(SEED_PLANT, { annualDemandKits: 5000000 }));
    expect(r.plannedUnitsAtTakt).toBeLessThan(base.plannedUnitsAtTakt);
    expect(r.aheadOrBehind).toBeGreaterThan(base.aheadOrBehind);
    expect(r.unitsGood).toBeCloseTo(base.unitsGood, 8);
  });

  it("doubling the S5 cycle time moves the bottleneck to S5", () => {
    const plant = applyLevers(SEED_PLANT, { cycleTimeSeconds: { S5: 24 } });
    expect(computeClosedForm(plant).bottleneckStationId).toBe("S5");
    expect(simulateShift(plant).bottleneckStationId).toBe("S5");
  });
});

describe("applyLevers", () => {
  it("does not mutate the seed and lets per-station overrides win", () => {
    const before = JSON.stringify(SEED_PLANT);
    const p = applyLevers(SEED_PLANT, {
      cycleTimeMultiplier: 2,
      firstPassYield: 0.9,
      availability: 0.8,
      scheduledHours: 8,
      seed: 7,
      cycleTimeSeconds: { S2: 5 },
      firstPassYieldByStation: { S3: 0.5 },
      availabilityByStation: { S4: 1 },
    });
    expect(JSON.stringify(SEED_PLANT)).toBe(before);
    expect(p.stations[0].cycleTimeSeconds).toBe(24);
    expect(p.stations[1].cycleTimeSeconds).toBe(5);
    expect(p.stations[2].firstPassYield).toBe(0.5);
    expect(p.stations[0].firstPassYield).toBe(0.9);
    expect(p.stations[3].availability).toBe(1);
    expect(p.stations[0].availability).toBe(0.8);
    expect(p.shifts.every((s) => s.scheduledHours === 8)).toBe(true);
    expect(p.rngSeed).toBe(7);
  });

  it("clamps invalid values with a note and never produces NaN", () => {
    const bad = {
      parallelLines: 0,
      annualDemandKits: -5,
      cycleTimeMultiplier: 0,
      firstPassYield: 1.4,
      availability: -0.2,
      scheduledHours: 0,
      seed: Number.NaN,
    };
    const { levers, notes } = sanitizeLevers(bad);
    expect(notes.length).toBe(7);
    expect(levers.parallelLines).toBe(1);
    expect(levers.firstPassYield).toBe(1);
    expect(levers.availability).toBe(0);
    expect(levers.scheduledHours).toBe(1);
    const r = simulateShift(applyLevers(SEED_PLANT, bad));
    const numbers = [
      r.unitsStarted, r.unitsGood, r.unitsScrap, r.wipAverage, r.yieldObserved,
      r.oee.availability, r.oee.performance, r.oee.quality, r.oee.oee,
      r.aheadOrBehind, r.lineTaktSeconds, r.analytical.unitsGood,
    ];
    for (const n of numbers) expect(Number.isFinite(n)).toBe(true);
    expect(r.unitsStarted).toBe(0); // availability 0: every machine is down all shift
  });
});

describe("mulberry32 (A16)", () => {
  it("is stable for seed 1", () => {
    const rng = mulberry32(1);
    const first = rng();
    expect(first * 4294967296).toBe(2693262067);
    expect(first).toBe(0.6270739405881613);
    expect(rng() * 4294967296).toBe(11749833);
  });
});

describe("downtime calendar (A17, A18)", () => {
  it("splits the default budget into 900 second events that sum exactly", () => {
    const d = eventDurations(0.9, 43200, 900);
    expect(d).toEqual([900, 900, 900, 900, 720]);
    expect(eventDurations(1, 43200, 900)).toEqual([]);
    expect(eventDurations(0.99, 43200, 900)).toEqual([432]);
  });

  it("places events inside the shift with no overlap, even when the shift is full", () => {
    for (const availability of [0.9, 0.5, 0.05, 0]) {
      const durations = eventDurations(availability, 43200, 900);
      const placed = placeMachineEvents(durations, 43200, mulberry32(3));
      let cursor = 0;
      let sum = 0;
      for (const p of placed) {
        expect(p.start).toBeGreaterThanOrEqual(cursor);
        cursor = p.start + p.duration;
        sum += p.duration;
      }
      expect(cursor).toBeLessThanOrEqual(43200);
      expect(sum).toBe(Math.round((1 - availability) * 43200));
    }
  });

  it("labels reasons by cycling 4, 3, 2, 1 per 10 events on the default plant", () => {
    const r = simulateShift(SEED_PLANT);
    expect(r.downtimeEvents.length).toBe(4 * 6 * 5);
    expect(r.downtimeByReason.breakdown.events).toBe(48);
    expect(r.downtimeByReason.changeover.events).toBe(36);
    expect(r.downtimeByReason.material_wait.events).toBe(24);
    expect(r.downtimeByReason.quality_hold.events).toBe(12);
    const shares = Object.values(r.downtimeByReason).reduce((a, x) => a + x.share, 0);
    expect(shares).toBeCloseTo(1, 10);
    const starts = r.downtimeEvents.map((e) => e.startSecond);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

// Two stations, one line, 60 ticks, c = 10, e = a = y = 1, n = 1.
function tinyPlant(): Plant {
  const station = (id: StationId, name: string): Station => ({
    id,
    name,
    cycleTimeSeconds: 10,
    parallelUnits: 1,
    operators: 1,
    firstPassYield: 1,
    availability: 1,
    performance: 1,
    sources: {},
  });
  return {
    ...SEED_PLANT,
    parallelLines: 1,
    rngSeed: 1,
    stations: [station("S1", "First"), station("S2", "Second")],
    shifts: [{ ...SEED_PLANT.shifts[0], scheduledHours: 60 / 3600 }],
  };
}

describe("F2 scripted discrete-time fixture", () => {
  const r = simulateShift(tinyPlant(), { yieldMode: "scripted" });

  it("matches the exact expected counts", () => {
    expect(r.scheduledSeconds).toBe(60);
    expect(r.unitsStarted).toBe(6);
    expect(r.stationStats.S1.outflowTotal).toBe(6);
    expect(r.stationStats.S2.outflowTotal).toBe(5);
    expect(r.unitsCompleted).toBe(5);
    expect(r.unitsGood).toBe(5);
    expect(r.unitsScrap).toBe(0);
    expect(r.wipEnd).toBe(1);
    expect(r.stationStats.S1.downtimeSeconds).toBe(0);
    expect(r.stationStats.S2.downtimeSeconds).toBe(0);
    expect(r.downtimeEvents).toEqual([]);
    expect(r.yieldObserved).toBe(1);
  });

  it("has the expected station timing", () => {
    expect(r.stationStats.S1.busySeconds).toBe(60);
    expect(r.stationStats.S1.blockedSeconds).toBe(0);
    expect(r.stationStats.S2.busySeconds).toBe(50); // first S2 start at t = 10
    expect(r.stationStats.S2.idleSeconds).toBe(10);
  });

  it("does not depend on the seed, because there are no draws", () => {
    const other = simulateShift({ ...tinyPlant(), rngSeed: 99 }, { yieldMode: "scripted" });
    expect(other.unitsGood).toBe(5);
    expect(other.wipEnd).toBe(1);
  });
});

describe("F3 scripted scrap fixture", () => {
  it("matches the exact expected counts", () => {
    const r = simulateShift(tinyPlant(), {
      yieldMode: "scripted",
      scriptedYield: (stationId, completionIndex) =>
        !(stationId === "S1" && completionIndex % 2 === 0),
    });
    expect(r.unitsStarted).toBe(6);
    expect(r.stationStats.S1.outflowGood).toBe(3);
    expect(r.stationStats.S1.scrap).toBe(3);
    expect(r.stationStats.S2.outflowTotal).toBe(3);
    expect(r.stationStats.S2.scrap).toBe(0);
    expect(r.unitsCompleted).toBe(3);
    expect(r.unitsGood).toBe(3);
    expect(r.unitsScrap).toBe(3);
    expect(r.wipEnd).toBe(0);
  });
});

describe("blocking with no buffers (A14)", () => {
  it("blocks a fast upstream station behind a slow downstream station", () => {
    const plant = tinyPlant();
    plant.stations[1].cycleTimeSeconds = 20;
    const r = simulateShift(plant, { yieldMode: "scripted" });
    expect(r.stationStats.S1.blockedSeconds).toBeGreaterThan(0);
    expect(r.unitsGood + r.unitsScrap + r.wipEnd).toBe(r.unitsStarted);
    expect(r.unitsGood).toBe(2); // S2 runs t = 10 to 29 and t = 30 to 49
  });
});

describe("finite buffers", () => {
  it("leaves the exact fixtures unchanged when capacity is 0 or unused", () => {
    const r = simulateShift({ ...tinyPlant(), bufferCapacity: 5 }, { yieldMode: "scripted" });
    expect(r.unitsStarted).toBe(6);
    expect(r.unitsGood).toBe(5);
    expect(r.wipEnd).toBe(1);
    expect(r.buffers.gaps[0].average).toBe(0); // balanced line never queues
  });

  it("lets a fast station keep working by filling the buffer, then blocks when full", () => {
    const plant = { ...tinyPlant(), bufferCapacity: 2 };
    plant.stations[1].cycleTimeSeconds = 20;
    const r = simulateShift(plant, { yieldMode: "scripted" });
    // S1 finishes at the end of ticks 9, 19, 29, 39, 49, 59. S2 takes one
    // every 20 s from t = 10 and finishes at 29 and 49. The buffer absorbs
    // the difference, so S1 never waits until its sixth unit finds the
    // buffer full at the very end of the shift.
    expect(r.unitsStarted).toBe(6);
    expect(r.stationStats.S1.outflowGood).toBe(6);
    expect(r.unitsGood).toBe(2);
    expect(r.stationStats.S1.blockedSeconds).toBe(0);
    expect(r.wipEnd).toBe(4); // one on S2, two in the buffer, one held on S1
    expect(r.unitsGood + r.unitsScrap + r.wipEnd).toBe(r.unitsStarted);
    expect(r.buffers.capacity).toBe(2);
    expect(r.buffers.gaps[0].average).toBeGreaterThan(0);
  });

  it("raises good units on the default plant and still conserves units", () => {
    const base = simulateShift(SEED_PLANT);
    const buffered = simulateShift(applyLevers(SEED_PLANT, { bufferCapacity: 5 }));
    expect(base.buffers.capacity).toBe(0);
    expect(buffered.unitsGood).toBeGreaterThan(base.unitsGood);
    expect(buffered.unitsGood + buffered.unitsScrap + buffered.wipEnd).toBe(buffered.unitsStarted);
    expect(buffered.unitsGood).toBeLessThanOrEqual(buffered.analytical.unitsGood);
    expect(buffered.buffers.gaps.length).toBe(5);
    for (const g of buffered.buffers.gaps) {
      expect(g.average).toBeGreaterThanOrEqual(0);
      expect(g.average).toBeLessThanOrEqual(5);
    }
  });
});

describe("fab hall (fictional)", () => {
  const closed = computeClosedForm(FAB_PLANT);
  const r = simulateShift(FAB_PLANT);

  it("has a source on every numeric station field and six areas in two bays", () => {
    expect(FAB_PLANT.parallelLines).toBe(2);
    expect(FAB_PLANT.stations.map((s) => s.id)).toEqual(IDS);
    for (const s of FAB_PLANT.stations) {
      for (const [key, value] of Object.entries(s)) {
        if (typeof value === "number") expect(s.sources[key]).toBeDefined();
      }
    }
  });

  it("derives takt from 1,200,000 wafers a year and makes lithography the bottleneck", () => {
    expect(closed.plantDemandPerHour).toBeCloseTo(1200000 / 365 / 24, 8);
    expect(closed.lineTaktSeconds).toBeCloseTo(3600 / (1200000 / 365 / 24 / 2), 8);
    expect(closed.teSeconds.S2).toBeCloseTo(900 / (17 * 0.95 * 0.9), 8);
    expect(closed.bottleneckStationId).toBe("S2");
    expect(r.bottleneckStationId).toBe("S2");
  });

  it("conserves wafers, stays at or below the rate model, and is deterministic", () => {
    expect(r.unitsGood + r.unitsScrap + r.wipEnd).toBe(r.unitsStarted);
    expect(r.unitsGood).toBeGreaterThan(0);
    expect(r.unitsGood).toBeLessThanOrEqual(closed.unitsGood);
    expect(r.buffers.capacity).toBe(5);
    expect(simulateShift(FAB_PLANT).unitsGood).toBe(r.unitsGood);
  });

  it("spends the exact downtime budget on every tool", () => {
    FAB_PLANT.stations.forEach((s) => {
      const budget = Math.round(0.1 * 43200) * 2 * s.parallelUnits;
      expect(r.stationStats[s.id].downtimeSeconds).toBe(budget);
    });
  });
});

describe("ramp test", () => {
  it("finds the line speed where the default plant starts holding takt", () => {
    const r = runRamp(SEED_PLANT, {}, "speed");
    expect(r.points.length).toBe(10);
    expect(r.points[3].value).toBe(1);
    expect(r.points[3].gap).toBeLessThan(0);
    expect(r.verdict).toBe("crosses");
    expect(r.breakValue).not.toBeNull();
    expect(r.breakValue!).toBeLessThan(1);
    expect(r.breakValue!).toBeGreaterThan(0.3);
    // Faster cycles never make fewer good units.
    for (let i = 1; i < r.points.length; i++) {
      expect(r.points[i].unitsGood).toBeGreaterThanOrEqual(r.points[i - 1].unitsGood);
    }
  });

  it("reports a break when no buffer size in range reaches takt", () => {
    const r = runRamp(SEED_PLANT, {}, "buffer");
    expect(r.verdict).toBe("breaks");
    expect(r.breakValue).toBeNull();
    expect(r.closest.unitsGood).toBeGreaterThan(r.points[0].unitsGood);
  });

  it("is deterministic", () => {
    expect(runRamp(SEED_PLANT, {}, "lines")).toEqual(runRamp(SEED_PLANT, {}, "lines"));
  });
});

describe("default plant simulation invariants", () => {
  const r = simulateShift(SEED_PLANT);

  it("conserves units", () => {
    expect(r.unitsGood + r.unitsScrap + r.wipEnd).toBe(r.unitsStarted);
    expect(r.unitsStarted).toBeGreaterThan(0);
  });

  it("spends the exact downtime budget at every station", () => {
    for (const id of IDS) {
      const budget = (1 - 0.9) * 43200 * 4 * 1;
      expect(Math.abs(r.stationStats[id].downtimeSeconds - budget)).toBeLessThanOrEqual(1);
      const fromEvents = r.downtimeEvents
        .filter((e) => e.stationId === id)
        .reduce((a, e) => a + e.durationSeconds, 0);
      expect(Math.abs(fromEvents - budget)).toBeLessThanOrEqual(1);
    }
  });

  it("is behind takt and at or below the closed-form good units", () => {
    expect(r.aheadOrBehind).toBeLessThan(0);
    expect(r.unitsGood).toBeLessThanOrEqual(12 * 4 * 256.5 * 0.97 ** 6);
    // A running product and 0.97 ** 6 differ in the last float digit.
    expect(r.rtyTheoretical).toBeCloseTo(0.97 ** 6, 12);
  });

  it("accounts for every machine second", () => {
    for (const id of IDS) {
      const s = r.stationStats[id];
      expect(s.busySeconds + s.blockedSeconds + s.idleSeconds + s.downtimeSeconds).toBe(43200 * 4);
    }
  });

  it("splits good units by hour and records a state timeline for line 1", () => {
    expect(r.goodByHour.length).toBe(12);
    expect(r.goodByHour.reduce((a, b) => a + b, 0)).toBe(r.unitsGood);
    expect(r.stateTimeline.binSeconds).toBe(60);
    for (const id of IDS) {
      const row = r.stateTimeline.rows[id];
      expect(row.length).toBe(720);
      // Line 1 has 5 downtime events per station: 4 of 15 minutes, 1 of 12.
      const downMinutes = row.filter((s) => s === "down").length;
      expect(Math.abs(downMinutes - 72)).toBeLessThanOrEqual(5);
    }
    expect(r.stateTimeline.rows.S6.includes("blocked")).toBe(false);
    expect(r.stateTimelines.length).toBe(4);
    expect(r.stateTimelines[0]).toBe(r.stateTimeline);
    expect(r.stateTimelines[3].rows.S1.length).toBe(720);
    const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0);
    expect(sum(r.flowByMinute.started)).toBe(r.unitsStarted);
    expect(sum(r.flowByMinute.good)).toBe(r.unitsGood);
    expect(sum(r.flowByMinute.scrap)).toBe(r.unitsScrap);
  });

  it("is deterministic for seed 1", () => {
    const again = simulateShift(SEED_PLANT);
    expect(again.downtimeEvents).toEqual(r.downtimeEvents);
    expect(again.unitsStarted).toBe(r.unitsStarted);
    expect(again.unitsGood).toBe(r.unitsGood);
    expect(again.unitsScrap).toBe(r.unitsScrap);
    expect(again.wipEnd).toBe(r.wipEnd);
  });

  it("changes with the seed while the closed form does not", () => {
    const other = simulateShift(applyLevers(SEED_PLANT, { seed: 2 }));
    expect(other.downtimeEvents).not.toEqual(r.downtimeEvents);
    expect(other.analytical).toEqual(r.analytical);
  });

  it("moves the simulated outputs in the documented lever directions", () => {
    const sim = (levers: Parameters<typeof applyLevers>[1]) =>
      simulateShift(applyLevers(SEED_PLANT, levers));
    expect(sim({ parallelLines: 6 }).unitsGood).toBeGreaterThan(r.unitsGood);
    expect(sim({ cycleTimeMultiplier: 1.5 }).unitsGood).toBeLessThan(r.unitsGood);
    const lowYield = sim({ firstPassYield: 0.9 });
    expect(lowYield.unitsGood).toBeLessThan(r.unitsGood);
    expect(lowYield.unitsScrap).toBeGreaterThan(r.unitsScrap);
    expect(lowYield.oee.quality).toBeLessThan(r.oee.quality);
    const lowAvail = sim({ availability: 0.8 });
    expect(lowAvail.unitsGood).toBeLessThan(r.unitsGood);
    expect(lowAvail.oee.availability).toBeLessThan(r.oee.availability);
    expect(sim({ scheduledHours: 8 }).plannedUnitsAtTakt).toBeLessThan(r.plannedUnitsAtTakt);
  });
});
