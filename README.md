# starfab

Unofficial fan or learning project, not affiliated with SpaceX.

starfab is a small, in-browser production-line simulation inspired by publicly described kit manufacturing at SpaceX's Bastrop, Texas site. It is a personal learning project and a proof of work for open Bastrop roles. It is not an official SpaceX or Starlink product, and it does not use official marks or logos.

Live placeholder: [https://starfab.vercel.app](https://starfab.vercel.app)

## What this repo is today

A static Vite + React + TypeScript app. It runs one simulated shift of a six-station, four-line teaching plant in the browser, with a deterministic, seeded, discrete-time engine (1 second ticks, no buffers, scrap without rework) and an analytical capacity calculator beside it as a cross-reference. The dark dashboard shows shift yield, OEE, WIP, station utilization with the bottleneck highlighted, a downtime Pareto, and what-if levers. Seed numbers live in [data/plant.seed.json](data/plant.seed.json), and every one is sourced or labeled `ASSUMPTION`.

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

There is no backend, no login, and no network call at runtime. `npm run build` writes a static site to `dist/`.

## Specs

- [docs/vision.md](docs/vision.md): why the project exists, and what "done" means for the first version
- [docs/factory-model.md](docs/factory-model.md): stations, takt, yield, downtime, shifts, and the data model
- [docs/features.md](docs/features.md): MVP versus later work
- [docs/data-sources.md](docs/data-sources.md): every public source, with a URL and date
- [docs/roadmap.md](docs/roadmap.md): the three-hour MVP plan, then later steps
- [docs/tech-spec.md](docs/tech-spec.md): the engine and UI contract, fixtures F1 to F3, and assumptions A15 to A20

## Rules

- Use public facts only. Put a source link and a date on each one.
- Label every assumed number as `ASSUMPTION`. Do not present an assumption as a measured factory figure.
- If a number is not known from a public source, write `unknown`. Do not invent a silent default in prose. Seed values used so the demo can run must still be marked `ASSUMPTION`.
- Do not use SpaceX or Starlink logos, wordmarks, or imagery, and do not imply official status. Keep the unofficial disclaimer visible.
- Do not put secrets, internal data, or credential material in this repo.

## License and use

This is a personal, unofficial project. Public facts belong to their original publishers. The model numbers that are labeled `ASSUMPTION` are teaching defaults, not claims about the real plant.
