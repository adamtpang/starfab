# Data sources

Unofficial fan or learning project, not affiliated with SpaceX.

Every public fact used in the spec is listed here with a URL and a date. Local research files are pointers to those public sources, not primary evidence by themselves. If a figure is an assumption, it does not belong in this file as a fact. See [factory-model.md](factory-model.md) for `A1` through `A14`.

## Site, investment, and volume

| Fact | Date | Source |
| --- | --- | --- |
| SpaceX employed 1,590 people at Bastrop, was hiring 100 to 150, planned hundreds more jobs averaging more than $75K, described an $855 million expansion, said it was moving all Starlink kit production to Bastrop, and stated a target of 10 million kits per year by the end of 2026. Majority of the jobs described as entry level. | Remarks May 26, 2026; recorded again Nov 14, 2026 | [Elgin Courier](https://www.elgincourier.com/article/4684,spacex-closer-to-855m-starlink-expansion) |
| Same county-meeting account, including local incentive coverage | May 26, 2026; recorded again Nov 14, 2026 | [Community Impact](https://communityimpact.com/bastrop-cedar-creek/development/bastrop-county-backs-spacex-application-for-state-sales-tax-incentive/) |
| Employment at the site could top 2,000 | May 26, 2026; recorded again Nov 14, 2026 | [Austin Business Journal](https://www.bizjournals.com/austin/news/2026/05/26/spacex-bastrop-county-starlink-incentives.html) |
| 60 to 80 percent of new hires at SpaceX Texas sites are local | Nov 12, 2026 | [SpaceX update, Starlink](https://www.spacex.com/updates/starlink/) |

## Greenhouse job board

Live pull from `https://boards-api.greenhouse.io/v1/boards/spacex/jobs?content=true` on Nov 14, 2026 at about 1:20 PM CT, summarized in `/workspace/jobs/starlink-bastrop-2026-11-14.md`.

| Fact | Date | Source |
| --- | --- | --- |
| 2,758 SpaceX-wide postings; 516 listed in Bastrop | Nov 14, 2026, about 1:20 PM CT | SpaceX Greenhouse board API, as recorded in the research note above |
| Starlink Production Associate, job 8697970002, first posted Aug 11, 2026. A/B 5:00 AM-5:30 PM Sunday-Tuesday or Thursday-Saturday plus every other Wednesday; C/D the same days, 5:00 PM-5:30 AM | Posting dates as above; confirmed listed Nov 14, 2026 | [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8697970002?gh_jid=8697970002) |
| Production Technician (Starlink), job 8692396002, first posted Aug 7, 2026. All shifts, overtime, weekends as needed. Posting names work areas: PCB, maintenance, silicon, gateway, solar, satellite ops | Posting dates as above; confirmed listed Nov 14, 2026 | [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8692396002?gh_jid=8692396002) |
| Full Stack Software Engineer, Manufacturing Systems, job 8934567002, posted Nov 8, 2026 | Posted Nov 8, 2026; recorded Nov 14, 2026 | [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8934567002?gh_jid=8934567002) |
| Software Engineer, Manufacturing, job 8928919002, posted Nov 3, 2026 | Posted Nov 3, 2026; recorded Nov 14, 2026 | [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8928919002?gh_jid=8928919002) |
| Application Software Engineer, Manufacturing Systems, job 8861910002, posted Oct 1, 2026 | Posted Oct 1, 2026; recorded Nov 14, 2026 | [Greenhouse posting](https://boards.greenhouse.io/spacex/jobs/8861910002?gh_jid=8861910002) |

Related public postings cited in the same research note, not required for the MVP model but kept for role context: Manufacturing Technician 8701771002 (Aug 12, 2026), Production Test Technician 8909171002 (Oct 28, 2026), Factory Software Engineer 8574053002.

## Starlink-tagged job snapshot (local file)

| Fact | Date | Source |
| --- | --- | --- |
| 1,264 Starlink-tagged jobs in the snapshot; 420 listed Bastrop, TX. Bastrop title-keyword counts: Manufacturing 44, Solar 44, Technician 36, PCB 28, Software 25, Test 25, Production 17, Assembly 15, Silicon 12, Gateway 10. Row update timestamps range from Nov 12 to Nov 13, 2026. | File written Nov 14, 2026 at 5:57 PM CT | Local snapshot `/workspace/jobs/org/starlink.json`, drawn from public SpaceX / Starlink job listings. This is a subset, not the 516 Bastrop count from the full board pull earlier that day. |

The snapshot is a list of public postings (job id, title, location, update time, first-posted time). It is not an internal org chart.

## Research notes (secondary)

These files sit on the author's machine and quote the public sources above. Prefer the original URLs when citing a fact.

- `/workspace/jobs/starlink-bastrop-2026-11-14.md`, written Nov 14, 2026
- `/workspace/jobs/starlink-reviews-2026-11-14.md`, written Nov 14, 2026 (reviews and hiring-speed notes; not used as factory-rate inputs)
- `/workspace/jobs/org/starlink.json`, written Nov 14, 2026 at 5:57 PM CT

## Explicitly not used as factory-rate inputs

Pay estimates, interview timelines, and employee reviews are out of scope for the production model. They may appear in job-search research, but they do not set takt, yield, or downtime in starfab.

## Gaps

No public source found (as of Nov 14, 2026) for real Bastrop kit-line cycle times, yields, downtime, line count, or a station-level layout. Those remain `unknown` or, when the demo needs a number, `ASSUMPTION`.
