# Fab hall model

Unofficial fan or learning project, not affiliated with SpaceX.

starfab now has two fictional halls that share one simulator:

- **Star hall:** the kit line described in [factory-model.md](factory-model.md). Unchanged.
- **Fab hall:** a fictional wafer line, described here. It is not a model of Terafab or of any real fab. Public figures are used only to pick a believable scale. Every number that makes it run is an `ASSUMPTION`.

Seed data: `data/fab.seed.json`. Assumption ids continue from the tech spec (A1 to A20) and start at A21.

## Public figure used for scale

An announced initial target of 100,000 wafer starts a month (Terafab launch, March 2026). Source and date are in [data-sources.md](data-sources.md). It is an announced target, not a measured output.

## Assumptions

| ID | Default | Statement |
| --- | --- | --- |
| A21 | Six process areas in series: S1 Deposition, S2 Lithography, S3 Etch, S4 Implant and anneal, S5 Wafer test, S6 Packaging | Textbook area names. Not a real fab's layout or route. |
| A22 | One unit is one wafer. Each station visit stands for all of that wafer's visits to that area | A real wafer returns to the same areas for dozens of layers. The model flattens that loop into one pass, and the cycle time at an area is the summed time one wafer spends there. This hides re-entrant queueing, which is a major effect in real fabs. |
| A23 | Summed cycle time per wafer per tool: Deposition 600 s, Lithography 900 s, Etch 600 s, Implant and anneal 300 s, Wafer test 240 s, Packaging 180 s | Invented round numbers with lithography slowest. Not measured. |
| A24 | Tools per area, per bay: 13, 17, 13, 7, 6, 4 | Chosen so most areas can roughly hold takt and lithography cannot. Real tool counts are unknown. |
| A25 | Yield 0.99 at each area. A failed wafer is scrapped, with no rework | Real yields are unknown, and real fabs measure yield per die, not per wafer. |
| A26 | Availability 0.90 at each area | Real tool availability is unknown. |
| A27 | Performance 0.95 versus the summed cycle | Real performance is unknown. |
| A28 | Demand of 1,200,000 wafers a year, spread evenly over 365 days and 24 hours | The announced 100,000 wafer starts a month, times 12, treated as demand for this fictional hall. |
| A29 | 2 identical bays in parallel | Real fab organisation is unknown. Two keeps the floor readable. |
| A30 | Room for 5 wafers between areas | Stands in for stockers and transport. Real buffer sizes are unknown and usually far larger. |
| A31 | Mean downtime event 1,800 seconds | Assumed. Same exact-budget rule as A17. |

The shift pattern (A1 to A3), tick length (A15), seed (A16), downtime reasons (A18), end-of-shift WIP (A19) and free starts at the first area (A20) are the same as in the star hall. Applying a posted production-associate shift pattern to a fictional fab hall is part of A1.

## Derived figures

- Hall demand = `1200000 / 365 / 24` = 136.99 wafers per hour
- Bay takt = `3600 / (136.99 / 2)` = 52.56 seconds per wafer
- Lithography effective time = `900 / (17 * 0.95 * 0.90)` = 61.92 seconds, slower than takt, so lithography is the bottleneck by design

## What the fab hall is not

- Not a re-entrant fab simulator. See A22.
- Not die-level yield, not lot-based dispatch, not a cleanroom layout.
- Not a prediction for any real site.
