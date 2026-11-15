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
| A41 | Each line receives 180 material kits every hour, has room for 360, and starts the shift with 180 | Invented. Starting a board or a housing takes one kit. A delivery that does not fit waits at the dock until it does. |
| A42 | 6 seconds to travel between stations | Invented. A part cannot be handed straight from machine to machine: it travels through the place after its station first. |

## How deliveries and travel time work in the engine

- **Deliveries.** A plant can carry a `supply` plan. Each line holds its own stock. The first delivery arrives one interval into the shift. A station that starts units and finds no stock is free and up but cannot start, and that time is reported as starved of material.
- **Travel time.** A plant can carry `transferSeconds`. A unit that leaves a machine becomes available to the next station only after that many seconds. Because it needs somewhere to be while it travels, every gap gets at least one place even when the buffer size is zero.
- **Rate model.** A starting station can go no faster than its even share of the delivered material. Travel time does not change the rate model, because it delays units without limiting how many can flow.

Two hand-traced fixtures in `src/engine/engine.test.ts` pin both behaviors second by second.

The shift pattern (A1 to A3), tick length (A15), seed (A16), downtime event rule (A17), downtime reasons (A18) and end-of-shift WIP (A19) are the same as in the star hall.

## What the assembly hall is not

- No lots: every unit moves on its own. Deliveries are one kit type, not a bill of materials.
- The even split of material between the two sub-lines in the rate model is a simplification. In the simulator the faster sub-line takes kits first.
- No part ratios other than one of each.
- Not a prediction for any real site.
