# Assembly hall model

Unofficial fan or learning project, not affiliated with SpaceX.

The assembly hall is the third fictional hall. It exists to show a flow that is not a straight line: two sub-lines make different parts, and one station joins them into a unit. It is not a model of any real plant, and it uses no public figure at all. Every number is an `ASSUMPTION`.

Seed data: `data/assembly.seed.json`. Assumption ids continue from the fab hall and start at A32.

## How joins work in the engine

- Each station feeds the next station in the list unless it names a later station in `feeds`. The last station is the only exit, and `feeds` can only point forward, so the flow cannot loop.
- A station fed by two or more stations is a join. It starts a unit only when it has one part ready from every stream that feeds it.
- A part is ready if it sits in its stream's buffer, or is held finished on an upstream machine that is up. A machine holding a finished part it cannot hand over counts as blocked.
- When a join starts, the parts become one unit. The parts absorbed this way are reported as `unitsMerged`, so the books still balance: started = good + scrap + WIP + merged.
- Every station with nothing feeding it starts parts whenever a machine is free (A20). Blocking and buffers are what stop a fast sub-line from running away.
- In the rate model, a join can build only as fast as its slowest stream.

A hand-traced fixture in `src/engine/engine.test.ts` ("matches the hand-traced join fixture exactly") pins this behavior tick by tick.

## Assumptions

| ID | Default | Statement |
| --- | --- | --- |
| A32 | Five stations: S1 Board build, S2 Housing mold, S3 Join and fasten, S4 Test, S5 Pack-out. S1 and S2 both feed S3 | Generic names. Not a real layout. |
| A33 | S3 needs one board and one housing to start a unit | Real assemblies can need many parts in other ratios. |
| A34 | Cycle times: 28 s, 22 s, 26 s, 50 s, 20 s | Invented, with the board sub-line slowest. |
| A35 | One machine per station, two at Test | Real counts are unknown. |
| A36 | Yield 0.98 at each station, no rework | Invented. |
| A37 | Availability 0.92 and pace 0.95 at each station | Invented. |
| A38 | Demand of 2,000,000 units a year, spread evenly | Invented. No public source. |
| A39 | 2 identical lines in parallel | Invented. |
| A40 | Room for 3 parts after each station | Invented. |

The shift pattern (A1 to A3), tick length (A15), seed (A16), downtime event rule (A17), downtime reasons (A18) and end-of-shift WIP (A19) are the same as in the star hall.

## What the assembly hall is not

- No supplier deliveries, no lots, and no transfer time between stations.
- No part ratios other than one of each.
- Not a prediction for any real site.
