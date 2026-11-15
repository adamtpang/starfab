# Vision

Unofficial fan or learning project, not affiliated with SpaceX.

## What starfab is

starfab is a learning project: a compact simulation of a kit production line, with a shift yield and downtime dashboard and a few what-if levers. It is also meant as a public proof of work for open roles at SpaceX's Bastrop, Texas site, especially:

- Production Technician, job 8692396002, [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8692396002?gh_jid=8692396002), first posted Aug 7, 2026, confirmed still listed in research dated Nov 14, 2026
- Full Stack Software Engineer, Manufacturing Systems, job 8934567002, [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8934567002?gh_jid=8934567002), posted Nov 8, 2026, recorded Nov 14, 2026
- Software Engineer, Manufacturing, job 8928919002, [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8928919002?gh_jid=8928919002), posted Nov 3, 2026, recorded Nov 14, 2026
- Application Software Engineer, Manufacturing Systems, job 8861910002, [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8861910002?gh_jid=8861910002), posted Oct 1, 2026, recorded Nov 14, 2026

The software postings above describe factory and manufacturing-systems work. A small, honest line model with a clear dashboard is a better demonstration than a generic portfolio site. The Production Technician posting is included because the same model is a way to learn how a line is talked about (takt, yield, downtime, shifts) before or alongside hands-on work.

## What it is not

- Not an official SpaceX or Starlink tool, study, or forecast
- Not a claim to know the real Bastrop layout, rates, yields, or schedules beyond what public sources state
- Not a recruitment site, and not an application

## Success for the MVP

A person can open the site, read the unofficial disclaimer, and in one screen:

1. See a single shift's planned time, runtime, downtime, units started, units completed, and good units
2. See first-pass yield, rolled throughput yield, and the bottleneck station
3. See whether the shift is ahead of or behind a demand takt that is derived from a cited public target plus labeled assumptions
4. Move a few levers (lines, yield, availability, cycle time, demand) and watch the shift results change
5. Open a short footnote list that separates sourced facts from `ASSUMPTION` values

The first build should be shippable in about three hours. See [roadmap.md](roadmap.md).

## Principles

- Public facts stay cited. Assumptions stay labeled. Unknowns stay unknown.
- Prefer a deterministic, inspectable calculator for the MVP over a heavy discrete-event engine.
- The UI stays dark, quiet, and free of official branding.
- Every number on the dashboard can be traced to a source, an assumption id, or a formula in [factory-model.md](factory-model.md).
