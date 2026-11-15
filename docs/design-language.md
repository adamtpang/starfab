# Design language: Vacuum drafting

Unofficial fan or learning project, not affiliated with SpaceX.

Chosen by Adam on Nov 14, 2026, after three rounds of previews. This file is the decision record. The tokens live in `src/styles.css`.

## What the project is

- **Subject:** one simulated shift on a kit production line.
- **Audience:** people who read factory dashboards, and people reviewing this as proof of work.
- **Primary job:** see at a glance whether the shift is behind takt, where the line is choked, and how a lever changes that.

## What the interface is made of

| Bucket | Count | What |
| --- | --- | --- |
| Interactive widgets | 4 kinds | number inputs, sliders, crew buttons, one disclosure |
| Data graphics | 6 | line elevation, OEE gauges, hour-by-hour board, downtime Pareto, state timeline, utilization bars |
| Reading content | small | assumption notes and citations |
| Marketing | 0 | none |

Shape: **data-graphic**.

## Decision

- **Component library: none.** Four widget kinds and no forms or accounts do not justify one. The page uses its own tokens and plain components.
- **Chart library: none.** The flat graphics are simple enough for hand-written SVG. If the page gains many standard charts, look at Observable Plot first.
- **3D library: three.js** (`three` 0.187, MIT, read from npm on Nov 14, 2026), added the same day for the floor twin. It is loaded as its own chunk so the figures paint before the 3D floor does.
- **Fonts:** Exo 2, IBM Plex Mono, IBM Plex Sans Condensed, bundled from the `@fontsource` npm packages (OFL-1.1). No font request leaves the site at runtime.
- **Design language:** Vacuum drafting, with the Weld arc palette.

## Where the language comes from

Three real artifacts from the subject's world:

1. **An engineering assembly drawing.** Title block, lettered details, leader lines, centerlines, dimension lines. It lends structure: every region of the page is a labeled part of one sheet.
2. **A lean hour-by-hour production board.** The whiteboard a real line updates every hour, plan against actual. It lends the main chart.
3. **A machine state timeline (Gantt of running, blocked, down).** It lends the clearest picture of why a line with no buffers loses so much output.

The space half is the setting, not the content: the sheet floats on a deep blue-black field with a few stars. No rockets, no logos, no mission-control imitation.

## Rules (each one checkable on a screenshot)

1. **One sheet.** The dashboard is a single bordered drawing with a title block on top. Regions inside it are lettered details (Detail A, Detail B), not floating cards.
2. **Lines, not surfaces.** Shapes are 1 px cyan outlines with dark fills. No shadows, no rounded corners, no gradients inside a detail.
3. **Violet asks for attention, red means stopped.** Violet marks the bottleneck, blocked time, the plan line and a behind-takt status. Red marks downtime only. Nothing else uses either color.
4. **Every status color has a second cue.** The bottleneck has a text label, behind takt has a triangle mark, and blocked marks are half the height of down marks.
5. **Big numbers are thin.** Headline figures are Exo 2 at weight 200 or 300 in white. Labels are small mono capitals in blue.
6. **Every seed number keeps its tag.** `ASSUMPTION A9` style tags stay visible wherever a seed value is shown.

## Tokens, in three layers

| Layer | Tokens | May change? |
| --- | --- | --- |
| Neutrals | `--page`, `--sheet-hi`, `--sheet-mid`, `--sheet-lo`, `--ink`, `--text`, `--dim`, `--rule` | No |
| Semantics | `--attention` (violet), `--fault` (red) | No |
| Drafting lines (theme) | `--line`, `--line-dim`, `--fill` | Yes. A different palette is a token override of these three, not a new language. |

## Themes

One language, two themes. Both follow the same six rules and differ only in token values.

- **Vacuum** (default): the dark Weld arc palette above.
- **Studio**: a light theme added on Nov 14, 2026, in the manner of a digital-twin vendor's studio renders. Light gray page, white details, dark ink, the same violet and red meanings. In the floor twin, Studio also turns on soft lighting and tints each machine body by state, where Vacuum keeps flat fills with colored outlines.

Switch with the toggle in the masthead, or open the page with `#studio` or `#vacuum` in the address. The choice is remembered in the browser.

## Type roles

- **Exo 2** names things and carries headline figures. Its thin weights read as precise and instrument-like.
- **IBM Plex Mono** carries labels, table figures and chart text, where digits must line up.
- **IBM Plex Sans Condensed** carries running text and notes.

## Signature element

The floor twin at the top of the sheet: every line and station as an outlined 3D floor, replayed as a time-lapse of the simulated shift, with small panels laid over it (clock, counters, shift-time scrubber, model basis). Machine outlines follow rule 3: cyan running, violet blocked, red down. The fills stay dark, so it still reads as a drawing, not a render.

The layout of that view (a 3D floor with overlay panels and a "model basis" note) follows the convention of factory digital-twin products. Adam asked for it on Nov 14, 2026 after reviewing public twin simulations. The page carries no other company's name, logo or artwork, and the model basis panel says plainly that the line is fictional.

The line elevation (Detail A) is the second signature: six isometric blocks on a conveyor centerline, block height showing utilization, with the bottleneck in violet under a slow pulse.

## Options considered

Versions, licenses and publish dates were read from npm on Nov 14, 2026. Looks were judged from the public sites, not from adopting them.

| Option | License | Last publish | Why not |
| --- | --- | --- | --- |
| Own tokens, no library | n/a | n/a | Chosen |
| Astro UXDS (`@astrouxds/react` 8.0.0) | not verified | 2026-06-23 | Reads as an official operations console |
| Siemens iX (`@siemens/ix-react` 5.3.0) | MIT | 2026-11-10 | Heavy for one page, brings its own look |
| Blueprint (`@blueprintjs/core` 6.23.0) | Apache-2.0 | 2026-11-13 | Generic look |
| Carbon (`@carbon/react` 1.120.0) | Apache-2.0 | 2026-11-13 | Looks like its owner |
| Arwes (`@arwes/react`) | MIT | 2025-02-05, prerelease | Stale, movie sci-fi |
| augmented-ui 2.0.0 | BSD-2-Clause | 2022-07-01 | Stale |

Palettes previewed on the same sheet: Safety orange, Andon light, Steel and brass, Cleanroom yellow, Weld arc. Adam chose Weld arc.

## Revisit when

- The site gains forms, accounts or more than about five widget kinds (then consider a component library).
- The page gains many standard charts (then consider Observable Plot).
- A second product area needs its own look (then add a theme by overriding the drafting-line tokens).
