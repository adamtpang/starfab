# Factory model

Unofficial fan or learning project, not affiliated with SpaceX.

This document is a teaching model. It is not a description of the real Bastrop kit factory's layout, staffing, or rates. Public facts are cited with a source and a date. Every number used to make the demo runnable is marked `ASSUMPTION` and given an id (`A1`, `A2`, ...). Anything else is `unknown`.

## 1. Public context (sourced)

These statements are about the site and the public hiring picture. They are not measurements from a factory data system.

- SpaceX told Bastrop County it employed 1,590 people at Bastrop, was hiring 100 to 150 at that time (technicians, operators, engineers, and support), planned hundreds more jobs averaging more than $75K, described an $855 million expansion, said it was moving all Starlink kit production to Bastrop, and stated a target of 10 million kits per year by the end of 2026. It also said the majority of the jobs would be entry level. Date of remarks: May 26, 2026. Sources: [Elgin Courier](https://www.elgincourier.com/article/4684,spacex-closer-to-855m-starlink-expansion), [Community Impact](https://communityimpact.com/bastrop-cedar-creek/development/bastrop-county-backs-spacex-application-for-state-sales-tax-incentive/), [Austin Business Journal](https://www.bizjournals.com/austin/news/2026/05/26/spacex-bastrop-county-starlink-incentives.html) (the last notes employment could top 2,000). Recorded again in research dated Nov 14, 2026.
- A SpaceX update dated Nov 12, 2026 said 60 to 80 percent of new hires at its Texas sites are local: [spacex.com/updates/starlink](https://www.spacex.com/updates/starlink/).
- Open roles used as context, from the SpaceX Greenhouse board, pulled Nov 14, 2026 about 1:20 PM CT via `boards-api.greenhouse.io/v1/boards/spacex/jobs?content=true`, and recorded in `/workspace/jobs/starlink-bastrop-2026-11-14.md`:
  - 2,758 SpaceX-wide postings, of which 516 were listed in Bastrop
  - Starlink Production Associate, job 8697970002, first posted Aug 11, 2026, [posting](https://boards.greenhouse.io/spacex/jobs/8697970002?gh_jid=8697970002). Schedule text on the posting: A/B shifts 5:00 AM to 5:30 PM Sunday-Tuesday or Thursday-Saturday plus every other Wednesday; C/D shifts the same days, 5:00 PM to 5:30 AM
  - Production Technician (Starlink), job 8692396002, first posted Aug 7, 2026, [posting](https://boards.greenhouse.io/spacex/jobs/8692396002?gh_jid=8692396002). The posting says technicians are trained into the team where they will have the greatest impact, and it names work areas: PCB, maintenance, silicon, gateway, solar, and satellite ops. Shift language: all shifts, overtime, weekends as needed
- A local snapshot of Starlink-tagged public job listings, file `/workspace/jobs/org/starlink.json`, written Nov 14, 2026 at 5:57 PM CT, with row update timestamps from Nov 12 to Nov 13, 2026, contained 1,264 jobs, of which 420 listed Bastrop, TX. That 420 figure is a Starlink-tagged subset. It is not the same as the 516 Bastrop postings counted on the full SpaceX board earlier the same day. Title-keyword counts in the Bastrop rows of that snapshot (a job title may match more than one keyword): Manufacturing 44, Solar 44, Technician 36, PCB 28, Software 25, Test 25, Production 17, Assembly 15, Silicon 12, Gateway 10. These are public job titles. They are not a confirmed list of production stations and they are not a headcount.

Unknown from public sources, and therefore not filled in as facts:

- The real station map, cycle times, first-pass yields, and downtime of the kit line
- How many independent kit lines run, and how "kit" is counted internally
- Whether the 10 million kits per year figure was a 2026 exit rate, a capacity target, or something else, and whether it was reached
- Actual shift calendars for the kit line (the A/B/C/D pattern is taken from the Production Associate posting, not from a published line schedule)
- Staffing per station, buffer sizes, and scrap or rework policy

## 2. Shifts

Sourced pattern, from the Starlink Production Associate posting (job 8697970002, recorded Nov 14, 2026):

| Crew | Clock time on the posting | Days on the posting |
| --- | --- | --- |
| A or B | 5:00 AM to 5:30 PM | Sunday-Tuesday or Thursday-Saturday, plus every other Wednesday |
| C or D | 5:00 PM to 5:30 AM | Same day pattern as A/B |

`A1` ASSUMPTION: The MVP applies this A/B/C/D pattern to the simulated kit line. That is a modeling convenience. It is not confirmed as the kit line's actual roster.

`A2` ASSUMPTION: Elapsed shift length is 12.5 hours, which follows directly from 5:00 to 5:30. Of that, 30 minutes is an unpaid meal break, leaving 12.0 hours of scheduled production time. The 30-minute meal break is assumed, not stated as a number on the posting. The Nov 14, 2026 research note used the same 30-minute unpaid lunch when estimating paid hours. That research note is not a SpaceX document.

`A3` ASSUMPTION: The line is modeled as covered 24 hours a day, 365 days a year, by the four crews. Planned holidays and planned shutdowns are unknown and are defaulted to none in the MVP.

## 3. Demand and takt

Sourced demand statement: 10 million kits per year by the end of 2026, from the May 26, 2026 county remarks cited above.

`A4` ASSUMPTION: For the demo, that figure is treated as a plant-wide annual finished-kit demand of 10,000,000. It is not treated as a verified 2026 actual.

`A5` ASSUMPTION: A "kit" in the model is one finished unit at pack-out. Public articles say "kits" and do not define the bill of materials. The model does not claim to know what is inside a kit.

`A6` ASSUMPTION: Demand is spread evenly over 365 days and 24 hours. Real seasonality is unknown.

Derived from the sourced 10,000,000 figure plus `A4`, `A5`, and `A6` (these are derived, not independently sourced):

- 10,000,000 / 365 = 27,397.26 kits per day plant-wide
- 27,397.26 / 24 = 1,141.55 kits per hour plant-wide
- Plant takt, if one theoretical constraint had to meet that hourly rate, would be 3600 / 1,141.55 = 3.15 seconds per kit

`A7` ASSUMPTION: The plant is modeled as 4 independent, identical kit lines in parallel. The real number of lines is unknown. Four is chosen so that line-level cycle times fall in a range that is easy to read on a dashboard.

Derived from the plant hourly rate plus `A7`:

- 1,141.55 / 4 = 285.39 kits per hour per line
- Line takt = 3600 / 285.39 = 12.61 seconds per kit

That 12.61 second line takt is the MVP's default demand pace. A what-if lever can change demand or the line count, and takt is recomputed.

## 4. Stations

The real station sequence is `unknown`. The Production Technician posting (job 8692396002, recorded Nov 14, 2026) names work areas (PCB, maintenance, silicon, gateway, solar, satellite ops). Those names are used only as a hint for a generic teaching line. They are not a leaked or confirmed layout.

`A8` ASSUMPTION: The MVP uses six stations in series on each line. Names are generic on purpose.

| id | name | role in the teaching model |
| --- | --- | --- |
| S1 | Kitting | Stage components for one kit |
| S2 | Electronics | Board or module work |
| S3 | Mechanical assembly | Structure, housings, fasteners |
| S4 | Integration | Join electronics to the mechanical assembly |
| S5 | Test | Functional or acceptance test |
| S6 | Pack-out | Final kit pack and label |

`A9` ASSUMPTION: Default engineered cycle time at each station, before parallelism and before losses, is 12.0 seconds. That is slightly inside the 12.61 second line takt so the demo is not born already infeasible. It is not a measured cycle time.

`A10` ASSUMPTION: Each station has 1 parallel unit (one workspace) in the default seed. Operators per station default to 1. Real staffing is unknown.

`A11` ASSUMPTION: Default first-pass yield is 0.97 at every station. Real yields are unknown. Rework is not modeled in the MVP; failed units are counted as scrap at that station and do not consume downstream time.

`A12` ASSUMPTION: Default availability is 0.90 at every station (10 percent of scheduled time is lost to planned plus unplanned downtime). Real downtime is unknown. The MVP does not split planned versus unplanned unless a later lever is added. Mean time to repair is not used in the MVP calculator.

`A13` ASSUMPTION: Default performance efficiency is 0.95 (pace versus the engineered cycle). Real performance is unknown.

`A14` ASSUMPTION: Inter-station buffers are ignored in the MVP. The line is treated as paced by its constraint station. This overstates the effect of a local outage and is accepted to keep the first build inside three hours.

## 5. Shift calculator (MVP math)

Let:

- `H` be scheduled production hours in the shift (`A2`: 12.0)
- `P` be parallel lines (`A7`: 4)
- `takt_line` be 3600 / (hourly_demand / P) seconds
- For station `i`: cycle `c_i` seconds (`A9`), parallel units `n_i` (`A10`), first-pass yield `y_i` (`A11`), availability `a_i` (`A12`), performance `e_i` (`A13`)

Effective process time at station `i` for one good attempt:

`te_i = c_i / (n_i * e_i * a_i)`

Stations are in series with no buffers (`A14`), and scrap at `i` does not flow downstream (`A11`). The constraint is the station with the lowest good-unit rate.

Start rate at station 1 (kits per hour, all lines):

`start_rate = P * 3600 / te_1`

Good-unit rate at station `i`:

`good_rate_i = P * (3600 / te_i) * y_i`

Because upstream scrap reduces what a downstream station sees, the flow into station `i` is the good-unit rate of station `i-1` (or `start_rate` for `i = 1`). The actual good-unit rate at `i` is:

`out_i = min(in_i, P * 3600 / te_i) * y_i`

The shift totals are those hourly rates times `H`:

- Units started = `in_1 * H`
- Units completed (reached pack-out, before pack-out yield) = inflow to S6 times `H`
- Units good = `out_6 * H`
- Rolled throughput yield (RTY) = `y_1 * y_2 * ... * y_6`
- First-pass yield displayed on the dashboard is RTY, with per-station yields available in a detail list
- Runtime hours at the constraint = `H * a_constraint`
- Downtime hours at the constraint = `H * (1 - a_constraint)`
- Planned units at takt = `H * 3600 / takt_line * P`
- Ahead or behind = units good minus planned units at takt

If a station's `te_i` makes it unable to hold takt even at `y_i = 1`, the dashboard marks that station as the bottleneck and shows the shortfall.

Worked default, with `A2` and `A7` through `A13` (all assumed except the sourced 10 million demand that feeds takt):

- `te_i = 12.0 / (1 * 0.95 * 0.90) = 14.035 seconds`
- Capacity attempts per hour per line = 3600 / 14.035 = 256.50
- RTY = 0.97^6 = 0.8329
- If the line were not yield-constrained between stations, good units per hour per line would be 256.50 * 0.97 at the last station only if earlier stations did not remove units. Under the series rule above, each station both loses availability and yields 0.97, so outflow compounds. With equal stations, `out_6` per line = 256.50 * 0.97^6 = 213.63 good kits per hour
- Four lines: 854.52 good kits per hour, versus demand of 1,141.55, so the default seed runs behind takt. That is intentional: the first what-if is to add a line, raise availability, or lower cycle time, and watch the gap close

These worked figures are consequences of the assumptions. They are not factory measurements.

## 6. Data model

Types are shown in TypeScript so the three-hour build can copy them. Seed values must carry a `source` of `"assumption"` or a citation object.

```ts
type Source =
  | { kind: "assumption"; id: string; note: string }
  | { kind: "public"; title: string; url: string; date: string; excerpt?: string }
  | { kind: "derived"; from: string[]; formula: string };

type StationId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

interface Station {
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

interface ShiftPattern {
  crew: "A" | "B" | "C" | "D";
  startClock: string; // "05:00" or "17:00", from the posting
  endClock: string; // "17:30" or "05:30", from the posting
  daysNote: string; // sourced posting text, summarized
  scheduledHours: number; // A2
  mealBreakMinutes: number; // A2
}

interface Plant {
  name: "starfab teaching model";
  unofficialDisclaimer: string;
  annualDemandKits: number; // sourced 10,000,000 plus A4
  calendarDays: number; // A6
  hoursPerDay: number; // A3 / A6
  parallelLines: number; // A7
  stations: Station[];
  shifts: ShiftPattern[];
}

interface WhatIfLevers {
  parallelLines?: number;
  annualDemandKits?: number;
  cycleTimeSeconds?: Partial<Record<StationId, number>>;
  firstPassYield?: Partial<Record<StationId, number>>;
  availability?: Partial<Record<StationId, number>>;
  performance?: Partial<Record<StationId, number>>;
  scheduledHours?: number;
}

interface ShiftResult {
  crew: ShiftPattern["crew"];
  scheduledHours: number;
  runtimeHoursConstraint: number;
  downtimeHoursConstraint: number;
  unitsStarted: number;
  unitsCompleted: number;
  unitsGood: number;
  unitsScrap: number;
  rty: number;
  lineTaktSeconds: number;
  plannedUnitsAtTakt: number;
  aheadOrBehind: number;
  bottleneckStationId: StationId;
  stationOutflow: Record<StationId, number>;
}
```

Seed data should live in a plain JSON file (for example `data/plant.seed.json`) so assumptions can be edited without changing calculator code.

## 7. What-if levers (MVP)

Keep the first set small:

- Parallel lines
- Annual demand (kits per year)
- A global cycle-time multiplier, plus optional per-station overrides
- A global first-pass yield override, plus optional per-station overrides
- A global availability override
- Scheduled hours in the shift

Each lever change recomputes `ShiftResult` on the client. No backend is required for the MVP.

## 8. Extending the model later

The types above can take, without a rewrite:

- Planned versus unplanned downtime, MTBF, and MTTR
- Rework loops instead of scrap-at-station
- Buffers and a discrete-event engine
- Per-shift historical logs, if any public or permissioned data ever exists
- More stations, or separate lines with different station sets (for example a solar cell line versus a kit pack-out line). Public job titles mention those areas. That is not evidence they share this station map.
