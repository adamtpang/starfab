# CLAUDE.md - starfab

Unofficial fan or learning project, not affiliated with SpaceX.

## Scaffold

Scaffolded on 2026-11-14 from the official Vite `react-ts` template (MIT), via `npm create vite@latest -- --template react-ts`. Source: https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts. The demo assets, the lint setup, and the sample component were stripped. Vitest was added for engine tests.

## Rules for this repo

- Read `docs/HANDOFF-fable.md` and `docs/tech-spec.md` before changing the engine or UI.
- Keep the disclaimer visible: "Unofficial fan or learning project, not affiliated with SpaceX."
- Dark UI by default (the light Studio theme is an opt-in toggle). No em dashes anywhere. No SpaceX or Starlink logos or wordmarks.
- Every number is sourced (link plus date) or labeled `ASSUMPTION`. Assumption ids A1 to A20 are fixed.
- No secrets in git. Do not commit `.env*` or `.vercel/`.
- Do not push to `main` and do not deploy. Adam deploys.

## Design language

The look is "Vacuum drafting" with the Weld arc palette, chosen by Adam on 2026-11-14. Rules, tokens and the options that were rejected are in `docs/design-language.md`. Read it before changing any style. No component library and no chart library. The floor twin uses `three` (MIT, https://threejs.org), loaded as a separate chunk. Fonts come from the `@fontsource/exo-2`, `@fontsource/ibm-plex-mono` and `@fontsource/ibm-plex-sans-condensed` npm packages (OFL-1.1, https://fontsource.org).

## Layout

- `data/plant.seed.json`: star hall seed (the kit line), with a source on every number
- `data/fab.seed.json`: fab hall seed (fictional wafer line, assumptions A21 to A31 in `docs/fab-hall-model.md`)
- `data/assembly.seed.json`: assembly hall seed (two sub-lines meeting at a join, assumptions A32 to A40 in `docs/assembly-hall-model.md`)
- `src/engine/topology.ts`: which station feeds which. A station's optional `feeds` names a later station; a station fed by two or more is a join
- `src/engine/`: `rng.ts`, `formulas.ts` (analytical calculator), `downtime.ts` (event calendar), `simulate.ts` (tick simulator), `engine.test.ts`
- `src/applyLevers.ts`: what-if levers, with clamping and notes
- `src/ramp.ts`: ramp test, sweeps one lever and finds where the line starts holding takt
- `src/plantFile.ts`: loads and checks a plant file picked by the visitor, and saves a hall in the same shape
- `src/ask.ts`: the rule-based question box. Fixed patterns only, every answer is a simulator run, unknown questions get "not understood". Keep it that way: no AI model without Adam changing the no-backend and no-paid-services rules
- `src/ui/`: dashboard components. `TwinView.tsx` is the 3D floor twin

## Beyond the tech spec

Added on 2026-11-14 at Adam's request: finite buffers between stations (`Plant.bufferCapacity`, seed value 0 per A14, lever range 0 to 20), the ramp test, the 3D floor twin, joins, a unit trace (`SimResult.trace`, one row per stay on a machine or in a buffer, which the floor twin replays), and display fields on `SimResult` (`goodByHour`, `stateTimeline`, `stateTimelines`, `flowByMinute`). Fixtures F1 to F3 are unchanged and still pass.

## Known spec note: bottleneck rule

`docs/tech-spec.md` defines the bottleneck as the lowest `out_i` (analytical) or lowest `outflowGood` (sim), yet fixture F1 requires `S1` for the symmetric default plant. Because scrap only shrinks the flow, lowest outflow is always the last station. The code follows `docs/factory-model.md` section 5 instead: the constraint is the station with the lowest stand-alone good-unit rate (capacity times yield), upstream station on a tie. That satisfies F1 and lets a slow station (for example a doubled S5 cycle) take the highlight.
