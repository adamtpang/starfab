# Tech spec: starfab MVP engine and UI

Unofficial fan or learning project, not affiliated with SpaceX.

This is the technical contract for the 3-hour MVP. It is part of the Fable brief with [HANDOFF-fable.md](HANDOFF-fable.md). Do not invent a different station map, different default numbers, or a different formula when this file already states one.

The closed-form calculator in section 4 is the same math as [factory-model.md](factory-model.md) section 5. The discrete-time simulator in section 5 is the dashboard's source of truth for a shift. Show both when it is cheap: analytical capacity as a footnote or secondary figure, simulated totals on the cards.

## 1. File and folder structure

Create roughly this tree. Names may vary by one folder if needed, but keep engine code separate from UI, and keep seed data in JSON.

```
starfab/
  package.json
  tsconfig.json
  tsconfig.node.json          # if Vite's default scaffold adds it
  vite.config.ts
  vitest.config.ts            # or a test config inside vite.config.ts
  index.html
  data/
    plant.seed.json
  src/
    main.tsx
    App.tsx
    styles.css
    types.ts
    applyLevers.ts
    engine/
      rng.ts
      formulas.ts             # closed-form capacity
      downtime.ts             # seeded event calendar
      simulate.ts             # discrete-time shift
    ui/
      Dashboard.tsx
      Levers.tsx
      StationTable.tsx
      DowntimePareto.tsx
      Disclaimer.tsx
    lib/
      format.ts
  docs/                       # already in the repo; do not delete
  .gitignore                  # already ignores .vercel, node_modules, .DS_Store, *.log, .env*
```

Do not add official artwork under `public/`. Do not commit `dist/`, `node_modules/`, `.env*`, or `.vercel/`.

## 2. Assumption table

Reuse A1-A14 unchanged. A15-A20 are extra assumptions needed so the discrete-time engine can run. They are still assumptions, not plant measurements.

### Sourced inputs (not assumptions)

| Item | Value | Date | Source |
| --- | --- | --- | --- |
| Annual kit target used as demand | 10,000,000 kits per year by end of 2026 | Remarks May 26, 2026; recorded again Nov 14, 2026 | [Elgin Courier](https://www.elgincourier.com/article/4684,spacex-closer-to-855m-starlink-expansion), [Community Impact](https://communityimpact.com/bastrop-cedar-creek/development/bastrop-county-backs-spacex-application-for-state-sales-tax-incentive/), [Austin Business Journal](https://www.bizjournals.com/austin/news/2026/05/26/spacex-bastrop-county-starlink-incentives.html) |
| Crew clock times and day pattern | A/B 5:00 AM to 5:30 PM, C/D 5:00 PM to 5:30 AM; Sunday-Tuesday or Thursday-Saturday plus every other Wednesday | Posting first dated Aug 11, 2026; confirmed listed Nov 14, 2026 | [Production Associate 8697970002](https://boards.greenhouse.io/spacex/jobs/8697970002?gh_jid=8697970002) |

Shift clock times are sourced. Applying them to this teaching line is A1. The 30-minute meal break and the 12.0 hours of production time are A2.

### A1-A14 (from factory-model.md)

| ID | Default | Statement |
| --- | --- | --- |
| A1 | Crews A, B, C, D | The MVP applies the public A/B/C/D pattern to the simulated kit line. Modeling convenience, not a confirmed kit-line roster. |
| A2 | 12.5 hours elapsed, 30 minute unpaid meal, 12.0 hours scheduled production | Meal length is assumed. Elapsed 12.5 hours follows from 5:00 to 5:30 on the posting. |
| A3 | 24 hours / day, 365 days / year, no holidays | Coverage and calendar. Planned shutdowns are unknown and default to none. |
| A4 | 10,000,000 treated as plant-wide annual finished-kit demand | The public figure is used as demo demand, not as a verified 2026 actual. |
| A5 | One kit = one finished unit at pack-out | Public articles say "kits" and do not define the bill of materials. |
| A6 | Demand spread evenly over 365 days and 24 hours | Seasonality is unknown. |
| A7 | 4 independent identical kit lines | Real line count is unknown. Four is a dashboard-scale choice. |
| A8 | Six stations in series: S1 Kitting, S2 Electronics, S3 Mechanical assembly, S4 Integration, S5 Test, S6 Pack-out | Generic teaching layout. Not a confirmed factory map. Public work-area names on [Production Technician 8692396002](https://boards.greenhouse.io/spacex/jobs/8692396002?gh_jid=8692396002) (recorded Nov 14, 2026) were only a hint. |
| A9 | Engineered cycle time 12.0 seconds at each station | Slightly inside the default 12.61 second line takt. Not a measured cycle. |
| A10 | 1 parallel unit and 1 operator per station | Real staffing is unknown. |
| A11 | First-pass yield 0.97 at each station; scrap does not rework or move downstream | Real yields are unknown. |
| A12 | Availability 0.90 at each station (10 percent of scheduled time is downtime) | Real downtime is unknown. Closed-form uses this as a rate. The sim turns it into an exact downtime budget (A17). |
| A13 | Performance efficiency 0.95 versus engineered cycle | Real performance is unknown. Process time while running is `c_i / e_i`. |
| A14 | Inter-station buffers ignored (queue capacity 0) | The line is blocking: a station that finishes while the next station is busy or down stays blocked. This can overstate a local outage relative to a buffered line. Accepted for the MVP. |

### A15-A20 (discrete-time engine only)

| ID | Default | Statement |
| --- | --- | --- |
| A15 | Tick = 1.0 second; simulate only scheduled production seconds | Default shift is 12.0 hours = 43,200 ticks. The meal break is outside the sim clock. |
| A16 | RNG seed = 1, algorithm = mulberry32 as in section 5.2 | Same seed must replay the same events and Bernoulli yields in Node and in the browser. |
| A17 | Exact downtime budget; mean event duration 15 minutes (900 seconds) | For each line, station, and parallel unit, total downtime seconds = `(1 - a_i) * H_seconds`. If budget is 0, no events. Otherwise event count is `max(1, round(budget / 900))`, durations are 900 seconds except the last event, which is adjusted so the sum is exact (a last event may be shorter or longer than 900). Starts are placed with the seeded RNG, no overlap, all intervals inside `[0, H)`. |
| A18 | Downtime reasons, in cycle order: breakdown, changeover, material_wait, quality_hold | Shares used only for labeling events (40%, 30%, 20%, 10% if you assign by cycling: 4, 3, 2, 1 in every 10 events). Not plant data. Use cycling, not weighted random draws, so tests stay exact. |
| A19 | Incomplete units at t = H are end-of-shift WIP | They do not count as completed, good, or scrap. |
| A20 | New units start at S1 whenever S1 is idle and up, without a takt-release limit | Takt is a demand pace for planned units and ahead/behind, not a gate on starts. The default plant is intentionally behind takt. |

Derived from the sourced 10,000,000 plus A4, A5, A6, and A7 (derived, not independently measured):

- Plant demand = `10000000 / 365 / 24` = 1,141.5525114155... kits per hour
- Line takt = `3600 / (plant_demand / P)` seconds. At P = 4, line takt = 12.6144... seconds
- Planned units in a shift = `H * plant_demand` = `12 * 10000000 / 365 / 24` = 13,698.630136986... units

## 3. Types and interfaces

Put these in `src/types.ts` (you may split files, but keep this shape). Seed JSON must be assignable to `Plant`.

```ts
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
  stations: Station[];
  shifts: ShiftPattern[];
}

export interface WhatIfLevers {
  parallelLines?: number;
  annualDemandKits?: number;
  cycleTimeMultiplier?: number;
  firstPassYield?: number;
  availability?: number;
  scheduledHours?: number;
  seed?: number;
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
}
```

`applyLevers(plant, levers)` returns a new `Plant` (do not mutate the seed). Global yield, availability, and cycle-time multiplier apply to every station unless a per-station override is also set (override wins). `scheduledHours` writes through to every crew's `scheduledHours` for the run. Clamp or reject invalid values as in section 7.

## 4. Closed-form formulas

These are the factory-model section 5 formulas. Implement in `formulas.ts`. Tests must use the exact expressions, not the rounded prose figures (213.63 and 854.52 were rounded in factory-model.md).

Let `H` be scheduled hours, `P` be parallel lines, `D` be `annualDemandKits / calendarDays / hoursPerDay` (kits per hour, plant-wide).

- `lineTaktSeconds = 3600 / (D / P)`
- For station `i`: `te_i = c_i / (n_i * e_i * a_i)`
- Capacity attempts per hour, all lines, at `i`: `cap_i = P * 3600 / te_i`
- `in_1 = cap_1`
- `out_i = min(in_i, cap_i) * y_i`
- `in_{i+1} = out_i`
- `rty = y_1 * y_2 * ... * y_6`
- Shift `unitsStarted = in_1 * H`
- `unitsCompleted` = inflow to S6 times `H` (attempts at pack-out)
- `unitsGood = out_6 * H`
- `unitsScrap = unitsStarted - unitsGood` in this rate model (no leftover WIP)
- Constraint = station with the lowest `out_i` per hour (if tied, the upstream station)
- `runtimeHoursConstraint = H * a_constraint`
- `downtimeHoursConstraint = H * (1 - a_constraint)`
- `plannedUnitsAtTakt = H * D`
- `aheadOrBehind = unitsGood - plannedUnitsAtTakt`

### Fixture F1 (required unit test)

Default plant: A2 and A7-A13, `H = 12`, `P = 4`, `c = 12`, `n = 1`, `e = 0.95`, `a = 0.90`, `y = 0.97` at all six stations, `annualDemandKits = 10000000`, 365 days, 24 hours.

Expect, using `toBeCloseTo` with 8 decimal places unless noted:

- `te_i === 12 / (1 * 0.95 * 0.90)` for every station, which is `12 / 0.855`
- Attempts per hour per line = `3600 / te_i`, which is exactly `256.5`
- `rty === 0.97 ** 6`
- Good kits per hour per line = `256.5 * (0.97 ** 6)`
- Good kits per hour, four lines = `4 * 256.5 * (0.97 ** 6)`
- `unitsGood === 12 * 4 * 256.5 * (0.97 ** 6)`
- `plantDemandPerHour === 10000000 / 365 / 24`
- `lineTaktSeconds === 3600 / (plantDemandPerHour / 4)`
- `plannedUnitsAtTakt === 12 * (10000000 / 365 / 24)`
- `aheadOrBehind < 0` (default plant is behind takt)
- Bottleneck may be any station in this symmetric case; pick the upstream tie-break, so `S1`

Also test a lever case: if `availability` is set to 1 and `firstPassYield` to 1 and `cycleTimeSeconds` stays 12 with `performance` 0.95, then `te_i = 12 / 0.95`, and good units per hour exceed default. If `parallelLines` is set to 6, line takt should widen (more seconds) and planned units stay `H * D` (demand is plant-wide). If `annualDemandKits` drops, planned units drop and ahead/behind improves.

## 5. Discrete-time engine

### 5.1 Tick rules

Simulate `scheduledSeconds = round(H * 3600)` ticks of length 1.0 second (A15). Use integer tick index `t = 0, 1, ..., scheduledSeconds - 1`. Work in a tick happens for that whole second.

Each line `0 .. P-1` is independent and identical in parameters, with its own RNG stream (section 5.2) and its own units.

Each station on a line has `n_i` parallel units (machines). Each machine has a status: `idle`, `busy`, `down`, or `blocked`.

Process time while running, in seconds: `c_i / e_i` (A9, A13). Store remaining process time as a float. During a busy tick that is not down, subtract 1.0. When remaining time goes from positive to `<= 0` during a tick, the unit completes at the end of that tick.

Order of work inside tick `t`, for each line, in station order from S6 down to S1 (downstream first, so a space frees before upstream tries to push):

1. If a downtime event covers this machine at tick `t` (start inclusive, start+duration exclusive), the machine is `down`. It does not process. If a unit is already on the machine, it stays there and its remaining time does not decrease (preempt). Blocked and idle machines can also be down.
2. Else if the machine is `busy` and remaining time after subtracting 1.0 is `<= 0`, complete the unit at the end of the tick: draw yield (section 5.4). If good and a downstream station exists, try to transfer at the end of the tick into an idle, up, empty downstream machine. If no downstream machine can take it, the completing machine becomes `blocked` and holds the finished unit until a later tick (A14, A19). If this is S6 (pack-out), a good unit increments `unitsGood` and `unitsCompleted`; a scrap increment `unitsScrap` and `unitsCompleted`. Scrap is removed and does not transfer.
3. Else if `busy`, remain `busy`.
4. If `blocked`, transfer as soon as a downstream machine is idle and up. Time spent waiting is `blockedSeconds`, not downtime.
5. After completions and transfers, S1 machines that are `idle` and not `down` start a new unit (A20). Increment `unitsStarted`. Set remaining process time to `c_1 / e_1`.
6. A downstream idle machine may also start a unit that was just transferred in this tick, with remaining time `c_i / e_i`, beginning process on the next tick (not the same tick it arrived). This keeps F2 exact.

At `t = scheduledSeconds`, stop. No new starts. Completions whose finish is the end of the last tick count. Units still on machines, including blocked finished units that never transferred, are `wipEnd` (A19).

WIP at the end of each tick is the count of units that have been started and have not yet left S6 as good or scrap (including blocked units). `wipAverage` is the mean of that count over all ticks (if `scheduledSeconds` is 0, use 0).

### 5.2 Seeded RNG (A16)

Use this mulberry32 implementation, no substitutes:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Default seed is 1. For line `L` (0-based), build a stream from `mulberry32((seed + (L + 1) * 10007) >>> 0)`. Use that stream first for downtime placement on that line (stations in S1..S6 order, then parallel unit index), then for yield draws in the order units complete (do not interleave a second unseeded `Math.random`).

Unit test: for `seed = 1`, the first number from `mulberry32(1)()` must be stable. Compute it once from this function and assert the exact float (or the exact 32-bit integer before the divide). Do not use `Math.random` in the engine.

### 5.3 Downtime events (A17, A18)

For each line, station, and parallel unit:

- `budget = (1 - a_i) * scheduledSeconds`
- If `budget <= 0`, no events.
- `nEvents = max(1, Math.round(budget / meanDowntimeEventSeconds))` with mean 900 by default.
- Durations: first `nEvents - 1` events are `min(900, budget)`-style 900-second chunks, last event = remaining budget so the sum is exactly `budget`. If `budget` is not an integer, round the budget to the nearest second first, then assign integers that sum to that integer. Adjust the last event if rounding would overflow `H`.
- Placement: draw a start in `[0, scheduledSeconds - duration]` with the line RNG, reject or shift forward until the interval does not overlap another event on the same machine and lies inside the shift. If a placement cannot be found after a reasonable number of tries (for example 100), pack the event into the earliest remaining gap; if no gap fits, attach leftover budget to an existing event on that machine so the budget is still exact.
- Reason: cycle breakdown, changeover, material_wait, quality_hold, starting from breakdown, in event start-time order after placement (not creation order), so the Pareto is stable.

A machine is down on tick `t` if some event has `startSecond <= t < startSecond + durationSeconds`.

Observed station downtime seconds, summed across lines and parallel units, must equal the planned budget for that station within 1 second in tests on the default plant (integer rounding).

### 5.4 Yield (A11)

When a unit completes at station `i`, draw `u` from the line RNG. If `u < y_i`, the unit is good; otherwise it is scrap and does not transfer. This is Bernoulli and is not exact in a short run.

For fixtures F2 and F3, tests must be able to pass a `yieldMode` of `"scripted"` used only in tests: either `y_i = 1` (no draws) or a provided function `(stationId, completionIndex) => boolean`. Production UI uses Bernoulli with the seeded RNG.

Theoretical RTY on the dashboard is still `product(y_i)`. Observed yield is `unitsGood / unitsCompleted` at pack-out.

### 5.5 Throughput, OEE, yield, WIP

All of these are computed from the sim, except `rtyTheoretical` and the analytical block.

Throughput:

- `throughputGoodPerHour = unitsGood / H` (use `H = scheduledSeconds / 3600`)

Yield:

- `rtyTheoretical = product of station firstPassYield`
- `yieldObserved = unitsGood / unitsCompleted` (0 if completed is 0)
- `yieldFromStarts = unitsGood / unitsStarted` (0 if started is 0)

WIP:

- `wipEnd` as in A19
- `wipAverage` as in section 5.1
- There is no buffer WIP (A14)

OEE, plant level, using the bottleneck station (lowest `outflowGood` in `stationStats`; upstream tie-break):

- `Availability = 1 - (constraint.downtimeSeconds / (P * n_constraint * scheduledSeconds))`
  which equals observed availability at the constraint, averaged over its machines and lines.
- `Performance = (unitsCompleted * designedCycleSeconds) / constraintRunSeconds`
  where `designedCycleSeconds` is the constraint's engineered `c_i` (A9, not divided by `e_i`), and `constraintRunSeconds` is the sum of non-down seconds on constraint machines (all lines). If run seconds is 0, Performance is 0. This should land near A13 (0.95) when the constraint is busy for most of its uptime and `c_i` is the designed cycle.
- `Quality = yieldObserved`
- `OEE = Availability * Performance * Quality`

Station utilization: `busySeconds / scheduledSeconds` per station, aggregated over lines and parallel units (divide by `P * n_i * scheduledSeconds` in the denominator, and sum busy ticks in the numerator). Show blocked and down as separate columns or stacked bars, not as busy.

Bottleneck highlight: the station with the lowest `outflowGood`. Tie: upstream station.

### 5.6 Fixture F2 (required unit test, exact)

Build a tiny plant in the test, not the default seed:

- `P = 1`, one line, two stations only (S1 and S2 are enough; if the type requires S1-S6, set S3-S6 to pass-through: `c = 0` is not allowed, so instead test a dedicated 2-station helper or allow the simulate function to accept a `Station[]` of length 2)
- `H` such that `scheduledSeconds = 60`
- `c_1 = c_2 = 10`, `e = 1`, `a = 1`, `y = 1`, `n = 1`
- No downtime events
- Seed can be 1; it must not matter because there are no draws

Expected, exactly:

- `unitsStarted = 6` (starts at t = 0, 10, 20, 30, 40, 50)
- S1 completions = 6 (end of ticks 9, 19, 29, 39, 49, 59)
- S2 starts on the tick after arrival, so first S2 start at t = 10, completions at end of ticks 19, 29, 39, 49, 59
- `unitsCompleted = 5`
- `unitsGood = 5`
- `unitsScrap = 0`
- `wipEnd = 1` (the sixth unit has finished S1 at the end of the last tick and either has not started S2 or arrives too late to process)
- Constraint downtime = 0
- `yieldObserved = 1`

If your transfer timing differs by one tick, fix the implementation to match these rules rather than changing the fixture.

### 5.7 Fixture F3 (required unit test, exact)

Same as F2, but scripted yield at S1: the 2nd, 4th, and 6th S1 completions are scrap (`completionIndex` 2, 4, 6 if 1-based). S2 yield is 1. No downtime.

Expected, exactly:

- `unitsStarted = 6`
- S1 good transfers = 3 (1st, 3rd, 5th)
- S1 scrap = 3
- S2 completions = 3 (there is time: those three goods arrive at t = 10, 30, 50 and finish at 20, 40, 60)
- `unitsCompleted = 3`
- `unitsGood = 3`
- `unitsScrap = 3` at the plant level (all scrap was at S1; none at S2)
- `wipEnd = 0`

### 5.8 Default-plant sim tests (required, not bit-exact on yield)

On the default seed and default plant:

- Conservation: `unitsGood + unitsScrap + wipEnd === unitsStarted`
- Downtime budget: for each station, observed downtime seconds is within 1 second of `(1 - 0.90) * 43200 * 4 * 1` (four lines, one machine)
- `aheadOrBehind < 0`
- `unitsGood` is less than or equal to the F1 closed-form `unitsGood` (blocking and leftover WIP can only reduce good units versus the rate model)
- `rtyTheoretical === 0.97 ** 6`
- The function is deterministic: two calls with seed 1 return deep-equal event calendars and equal unit counts

Do not assert exact Bernoulli good-unit counts for the 12-hour default plant unless you also check in a golden file generated by this same engine. Prefer the invariants above.

## 6. Dashboard UI

One page, dark, no logos. Reuse the placeholder tokens listed in the handoff. The unofficial disclaimer is visible at the top (and may be repeated in the footer).

Required regions:

1. Header: title `starfab`, the one-line description ("An unofficial production-line simulation of a kit factory, built as a learning project and proof of work."), and the disclaimer.
2. Crew selector: A, B, C, D. Crew changes the shift label and clock times. With A1-A3, production hours are the same for every crew in the MVP, so totals stay the same unless the user has changed `scheduledHours`. Still show the sourced clock string for the selected crew.
3. Shift yield cards: scheduled hours, runtime and downtime at the constraint, units started, completed, good, scrap, theoretical RTY, observed yield, line takt, planned units at takt, ahead or behind. Mark the default plant as behind takt.
4. OEE: availability, performance, quality, and the product, as four figures. Label them as model outputs, not factory KPIs.
5. WIP: average WIP and end-of-shift WIP, with a short note that buffers are assumed to be zero (A14).
6. Station utilization: a table or bar list with name, cycle time, yield, availability, utilization, blocked time, downtime, good outflow. Highlight the bottleneck row (accent border or label "bottleneck"). Do not use a logo as the marker.
7. Downtime Pareto: horizontal bars or a simple table of the four reasons, minutes (or hours), event count, and share of total downtime. If total downtime is 0, show an empty state, not a crash.
8. What-if levers: section 7.
9. Footer: disclaimer again, `ASSUMPTION` note, citation for the May 26, 2026 10 million kit statement next to the takt or demand figure (link the sources in data-sources.md), and links to `docs/` on GitHub (`https://github.com/adamtpang/starfab/tree/main/docs`).

Every seed number shown on screen gets a visible `ASSUMPTION` mark (id if space allows, for example `A9`). Derived figures can say "derived from sourced demand plus assumptions."

Do not use em dashes in labels. Prefer "ahead or behind", "started, completed, good", "runtime / downtime".

## 7. What-if levers

All levers recompute on the client: `applyLevers` then `computeClosedForm` plus `simulateShift`. No network.

| Lever | Control | Effect on outputs |
| --- | --- | --- |
| Parallel lines | Integer stepper, min 1, max 12, default 4 (A7) | Changes `P`, recomputes line takt (more lines: slower line takt, same plant demand), planned units unchanged, capacity and sim totals scale with lines, event count scales with lines. |
| Annual demand | Number input, min 1, default 10,000,000 (sourced plus A4) | Changes takt and planned units only. Capacity does not change. Ahead/behind improves if demand falls. Keep the May 26, 2026 citation visible. |
| Cycle-time multiplier | Slider or number, default 1.0, min 0.25, max 3.0 | Multiplies every `c_i` unless a per-station override is set. Higher multiplier: longer process time, lower throughput, higher utilization, more likely behind takt. |
| First-pass yield | Slider 0 to 1, default 0.97 (A11) | Sets every station `y_i` (overrides can still win). Lower yield: more scrap, lower good units, lower Quality and OEE, lower observed yield and theoretical RTY. |
| Availability | Slider 0 to 1, default 0.90 (A12) | Sets every `a_i`. Lower availability: larger downtime budget, more or longer Pareto events, lower Availability and OEE, lower throughput. |
| Shift length (scheduled hours) | Number, default 12, min 1, max 16 (A2 is 12) | Changes `H`, planned units, event budgets, and all shift totals. Does not change hourly demand. |
| Seed | Integer, default 1 (A16) | Replays downtime placement and Bernoulli yields. Closed-form results do not change. |

Optional if time remains: per-station cycle, yield, and availability overrides. If present, they beat the global sliders for that station and can move the bottleneck (for example, doubling S5 cycle time should move the highlight toward S5).

Invalid values: yield or availability outside `[0, 1]`, non-positive lines, hours, demand, cycle multiplier, or cycle time. Reject or clamp, and show a short message. Do not NaN the dashboard.

## 8. Tests (summary)

Required, all in Vitest, no network:

- F1 closed-form defaults and at least one lever case (section 4)
- mulberry32 stability for seed 1 (section 5.2)
- Downtime budget sums (section 5.3) on the default plant
- F2 exact counts (section 5.6)
- F3 exact counts (section 5.7)
- Default-plant invariants (section 5.8)

Do not snapshot the whole React tree. UI tests are optional and should not consume the 3-hour budget.

## 9. Copy and branding constraints

- Disclaimer text, exact: `Unofficial fan or learning project, not affiliated with SpaceX.`
- Page title: `starfab`
- One-line description, exact: `An unofficial production-line simulation of a kit factory, built as a learning project and proof of work.`
- Station names stay the generic A8 names. Do not rename them after official process names, and do not add marks or logotypes.
- No em dashes.

## 10. What not to build

No backend, no official branding, no silent numbers, no merge, no deploy, no secrets, no paid services. No attempt to predict the real Bastrop plant.
