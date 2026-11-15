# Features

Unofficial fan or learning project, not affiliated with SpaceX.

## MVP (about three hours)

The first shippable version is a static web app on Vercel, dark UI, with the unofficial disclaimer on the page.

In scope:

- A client-side plant seed (`data/plant.seed.json`) that follows [factory-model.md](factory-model.md)
- A deterministic shift calculator with unit tests or a small fixture table for the default worked example
- One dashboard view for a selected crew (A, B, C, or D):
  - Scheduled hours, runtime, and downtime at the constraint
  - Units started, completed, good, and scrap
  - Rolled throughput yield
  - Line takt and planned units at takt
  - Ahead or behind
  - Bottleneck station
- What-if levers: parallel lines, annual demand, cycle time, yield, availability, and shift length
- Visible labels that mark seed numbers as `ASSUMPTION` and that cite the 10 million kits per year figure as a public May 26, 2026 statement
- A short sources panel or footer linking to [data-sources.md](data-sources.md)
- No SpaceX or Starlink logos, and no official-looking marks

Out of scope for the MVP:

- Login, databases, or APIs
- Animation of every unit on a conveyor
- Discrete-event or Monte Carlo simulation
- Mobile-native apps
- Any use of non-public data

## Later

Only after the MVP is live and honest:

- Discrete-event simulation with buffers, random downtime, and rework
- Separate area models (for example electronics versus pack-out) clearly marked as invented partitions
- A shift log that can import a CSV, with a warning that live factory data must not be added unless Adam has permission to publish it
- Comparison of two what-if scenarios side by side
- A short written "how to read this dashboard" page for interviews
- Optional light tests against additional public statements, if any appear later

## Non-goals

- Predicting real Bastrop output, hiring, or pay
- Looking official
- Scraping or storing job-application data
- Spending money on paid APIs, plans, or assets
