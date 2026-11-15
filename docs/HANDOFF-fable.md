# Fable handoff: starfab MVP

Unofficial fan or learning project, not affiliated with SpaceX.

This file plus [tech-spec.md](tech-spec.md) is the complete build brief. Fable should not need any other chat context. Read both documents in full before writing code. For citations and the original A1-A14 prose, also use [factory-model.md](factory-model.md) and [data-sources.md](data-sources.md).

## Copy-paste kickoff prompt

Paste the block below to Fable as the starting prompt.

```
You are Fable, building the starfab MVP on bubba.

Work in C:\Users\adamp\Aether\starfab. The repo is https://github.com/adamtpang/starfab, already cloned, on branch main. Live placeholder: https://starfab.vercel.app (Vercel project name: starfab).

Read docs/HANDOFF-fable.md and docs/tech-spec.md in full before writing any code. Follow them exactly. Use docs/factory-model.md for A1-A14 and the closed-form worked example, and docs/data-sources.md for citations.

Build the 3-hour MVP: a Vite + React + TypeScript static app with a deterministic, seeded, discrete-time production-line simulator; unit tests for the engine with known expected outputs; and a dark dashboard that shows shift yield, a downtime Pareto, station utilization, a bottleneck highlight, and what-if levers.

Rules you must not break:
- Keep this disclaimer visible on the page: "Unofficial fan or learning project, not affiliated with SpaceX."
- Dark UI. No em dashes anywhere (code, comments, UI copy, or commit messages).
- No SpaceX or Starlink logos, wordmarks, or official-looking marks. Do not imply this is an official tool.
- Every number is sourced (link plus date) or labeled ASSUMPTION. Do not invent a silent default.
- No secrets in the repo. Do not commit .env, .env.local, or .vercel. Do not print tokens.
- Do not push to main. Branch off main and open a pull request against main.
- Do not deploy to Vercel (production or preview). Production does not auto-redeploy right now. Adam deploys or asks.
- No paid plans, signups, or spending. No dependencies that require an account.

When the acceptance criteria in docs/HANDOFF-fable.md are met, open the PR, paste the PR URL, and stop. Do not merge.
```

## Goal

starfab is a small, in-browser teaching simulation of a kit production line. It is a learning project and a public proof of work. It is not an official SpaceX or Starlink product, and it must not look like one.

The first shippable version is a single dark page where someone can:

1. Read the unofficial disclaimer immediately.
2. See one shift's planned time, runtime, downtime, units started, units completed, units good, scrap, end-of-shift WIP, and average WIP.
3. See rolled throughput yield, observed yield, OEE (availability, performance, quality), line takt, planned units at takt, and ahead or behind.
4. See station utilization, the bottleneck station highlighted, and a downtime Pareto by reason.
5. Move what-if levers and watch the simulated shift recompute on the client.
6. See every seed number marked `ASSUMPTION`, and see the 10 million kits per year figure cited as a public May 26, 2026 statement.

The simulator itself is not built yet. This repo today is the placeholder page plus specs.

## 3-hour MVP scope

In scope:

- Vite + React + TypeScript, static client only, unit tests with Vitest
- `data/plant.seed.json` following the types in [tech-spec.md](tech-spec.md)
- A closed-form capacity calculator that matches [factory-model.md](factory-model.md) section 5 exactly (this is the analytical check)
- A deterministic, seeded, discrete-time shift simulator that models stations, takt, cycle time, yield, downtime events, blocking with no buffers, and shifts
- The dashboard and levers listed above
- A PR against main when done

Out of scope for this pass:

- Login, databases, APIs, or a backend
- Conveyor animation of every unit
- Monte Carlo (beyond one seeded run)
- Rework loops (scrap does not return)
- Planned vs unplanned downtime as separate levers (reasons exist for the Pareto only)
- CSV import of real factory data
- Mobile-native apps
- Pushing to main, merging, or deploying
- Any non-public data
- Paid tools or new signups

If time runs short, cut per-station lever overrides and keep the global levers. Do not cut the disclaimer, assumption labels, closed-form fixture tests, or the scripted discrete-time fixture test.

## Recommended stack

Keep it simple and static, on the existing Vercel project.

- Vite 6 or current stable, React 18 or 19, TypeScript, Vitest
- CSS: a single stylesheet that reuses the placeholder tokens (`#0b0d10` background, `#e8eaed` text, `#9aa3ad` muted, `#23282f` rules, `#c9a227` accent). System or Georgia + monospace. No icon-font CDNs that pull brand marks.
- npm. No Next.js. No server runtime. No auth library.
- Deploy target (later, by Adam): the existing Vercel project named exactly `starfab`, team "adamtpang's projects", already linked to `https://github.com/adamtpang/starfab`. Vite's default `dist` output is fine. A small `vercel.json` is optional.

Do not change Vercel project settings (protection, domains, git link, or billing).

## Rules

- Dark UI.
- No em dashes in any file you add or edit, including comments and commit messages.
- No SpaceX or Starlink logos, wordmarks, or imagery, and no official implication.
- Visible disclaimer: "Unofficial fan or learning project, not affiliated with SpaceX."
- Every number is sourced (URL and date) or labeled `ASSUMPTION`. Missing facts stay `unknown`.
- Reuse assumption ids A1-A14 from [factory-model.md](factory-model.md) without renumbering. New sim-only assumptions are A15-A20 in [tech-spec.md](tech-spec.md).
- No secrets in git or in chat. Do not commit `.env`, `.env.local`, or `.vercel/`.
- No paid plans, signups, or spending.

## Deploy and git notes

- Production does not auto-redeploy when main moves. That was verified on Nov 14, 2026 after a docs commit to main: https://starfab.vercel.app stayed on the first placeholder deploy (`dpl_EuGtzB1kLuSWGFgaxZHpJXEyg9Hf`).
- Fable must not deploy with the Vercel CLI or dashboard, and must not push to `main`.
- Branch from current `main`, commit on the branch, and open a pull request against `main`.
- Adam deploys production, or asks someone to, after he reviews. Preview deploys, if Vercel creates one from the PR, are useful, but Fable should not trigger a production promote.
- Do not add secrets to Vercel or to the PR.

## Acceptance criteria

The PR is ready when all of the following are true:

1. `npm test` (or `npm run test`) passes, including the closed-form worked example and the scripted discrete-time fixture in [tech-spec.md](tech-spec.md) with the stated expected outputs.
2. `npm run build` produces a static output with no runtime backend.
3. The app loads locally (`npm run dev`) as a dark page that shows the unofficial disclaimer without scrolling on a laptop viewport.
4. Default seed plus default plant: the dashboard shows a shift that is behind takt, with four lines, six stations, and assumption labels on seed numbers. Line takt is derived from the cited 10 million kits per year figure (May 26, 2026).
5. The dashboard includes shift yield (started, completed, good, scrap, RTY, observed yield), OEE parts and total, WIP (average and end), downtime Pareto by reason, station utilization, and a clear bottleneck highlight.
6. Changing each lever listed in the tech spec recomputes the visible outputs in the direction described there. Invalid lever values (yield outside 0 to 1, zero or negative hours, and so on) are rejected or clamped with a visible note, not a blank screen.
7. No SpaceX or Starlink logos. No em dashes. No secrets in the diff.
8. A PR is open against `main`. Fable has not merged it and has not deployed.

## Ordered task checklist (about 3 hours)

Work in this order. Times are estimates and should sum to 180 minutes.

1. Scaffold (10 min). On a branch off `main`, add Vite + React + TypeScript + Vitest. Replace the root placeholder `index.html` with the Vite entry, keeping the same dark tokens and the disclaimer in the first UI commit. Add `package.json` scripts: `dev`, `build`, `preview`, `test`. Do not commit `.env*`, `.vercel/`, or `node_modules/`.
2. Types and seed data (20 min). Add `src/types.ts` and `data/plant.seed.json` exactly as specified in [tech-spec.md](tech-spec.md). Every numeric field has a `source` of `assumption` or a public citation. Include the unofficial disclaimer string in the seed.
3. Closed-form engine and tests (20 min). Implement `computeClosedForm` from [factory-model.md](factory-model.md) section 5. Lock fixture F1 in [tech-spec.md](tech-spec.md) with the exact expected expressions (use `toBeCloseTo` only where the spec says to).
4. Seeded RNG and downtime calendar (10 min). Implement mulberry32 as specified, plus the exact-budget downtime event generator (A17, A18). Test that durations per station sum to `(1 - a_i) * H` seconds (times parallel units and lines), and that seed 1 is stable.
5. Discrete-time simulator and tests (35 min). Implement the tick rules in the tech spec. Lock fixture F2 and F3 with the known expected outputs. Add conservation and downtime-budget tests on the default plant. Optionally assert that simulated good units are at or below the closed-form good units (blocking can only lose throughput versus the rate model).
6. Dashboard shell (25 min). Dark layout, disclaimer, crew selector A/B/C/D, shift summary cards, station utilization table, bottleneck highlight. Run the default sim on load.
7. Pareto, OEE, WIP, citations (20 min). Downtime Pareto by reason, OEE breakdown, average and end WIP, `ASSUMPTION` labels on seed numbers, and the May 26, 2026 10 million kit citation next to takt.
8. What-if levers (20 min). Wire the levers in the tech spec to a client-side recompute. Cover invalid states. Prefer global levers if the clock is tight; add per-station overrides only if time remains.
9. Polish and links (10 min). Contrast pass, footer links to the GitHub `docs/` folder, no leftover placeholder-only page, `npm test` and `npm run build` green.
10. Open the PR (10 min). Push the branch, open a PR against `main` with a short summary (what was built, how to run tests, reminder not to deploy until Adam says yes). Do not merge. Do not deploy.

## After the PR

Stop and report the PR URL. Do not start "later" work from [features.md](features.md) or [roadmap.md](roadmap.md) in this pass.
