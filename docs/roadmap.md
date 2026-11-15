# Roadmap

Unofficial fan or learning project, not affiliated with SpaceX.

The placeholder at [https://starfab.vercel.app](https://starfab.vercel.app) only holds the name and the unofficial disclaimer. The work below is the first real build.

## Three-hour MVP

Goal: a deployed, dark, self-contained dashboard that runs the calculator in [factory-model.md](factory-model.md), with assumptions labeled and the 10 million kit target cited. No backend, no paid services, no official branding.

### Hour 1: model and tests (about 60 minutes)

- Add `data/plant.seed.json` with stations, shift patterns, demand, and line count. Every numeric field has a `source` of `assumption` or a public citation.
- Add a small TypeScript or vanilla JS calculator that implements the shift formulas (effective process time, series outflow, RTY, takt, ahead or behind).
- Lock the default worked example from [factory-model.md](factory-model.md) section 5 with a fixture test: `te_i = 14.035` seconds, RTY = 0.97^6 = 0.8329, about 213.63 good kits per hour per line, about 854.52 good kits per hour for four lines, behind the 1,141.55 demand rate.
- Keep the unofficial disclaimer in the seed so the UI can render it from data.

### Hour 2: dashboard (about 60 minutes)

- Replace the placeholder page with a single-page dark UI.
- Crew selector (A, B, C, D) and a shift summary: scheduled hours, runtime, downtime, units started / completed / good / scrap, RTY, line takt, planned units, ahead or behind, bottleneck.
- A simple station table (name, cycle, yield, availability, outflow). No logos.
- Footer: unofficial disclaimer, plus links to this `docs/` folder on GitHub.

### Hour 3: levers, polish, deploy (about 60 minutes)

- Levers: parallel lines, annual demand, cycle-time multiplier, yield, availability, shift length. Recompute on the client.
- Flag any seed value used on screen as `ASSUMPTION`, and cite the May 26, 2026 10 million kit statement next to takt.
- Quick pass for contrast, typography, and empty or invalid lever states (for example yield outside 0 to 1).
- Deploy the MVP to the existing `starfab` Vercel project, production, only after the usual review rules (Adam's own yes to go beyond this already-approved placeholder).

If time runs short, cut per-station override inputs and keep only global levers. Do not cut the disclaimer, the assumption labels, or the fixture test.

## After the MVP

1. Scenario compare: save two lever sets and show the delta in good units and downtime.
2. Discrete-event mode: buffers, random downtime, rework loops. Keep the deterministic calculator as the default, trusted path.
3. Optional CSV shift log, with a hard warning not to import non-public factory data without permission.
4. A one-page "how to read this" note for interviews, still unofficial.
5. Only if new public facts appear, update [data-sources.md](data-sources.md) and tighten or replace assumptions.

## Sequencing constraints

- Public facts only, sources on every fact, `ASSUMPTION` on every invented number
- No SpaceX or Starlink logos, and no official implication
- No secrets in the repo
- No paid plans, signups, or spending
- Production deploys after the placeholder require Adam's yes, except where he has already approved a specific deploy
