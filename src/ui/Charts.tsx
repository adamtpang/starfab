import { fmtInt, fmtPct } from "../lib/format";
import type { MachineState, Plant, ShiftPattern, SimResult } from "../types";

// Drafting-sheet graphics. Plain SVG, colored only through the CSS classes in
// styles.css, so the palette lives in one place.

function hourLabel(shift: ShiftPattern, offset: number): string {
  const start = Number(shift.startClock.split(":")[0]);
  return String((start + offset) % 24).padStart(2, "0");
}

// Detail A. Each station is an isometric block. Block height is utilization.
export function LineElevation({ plant, sim }: { plant: Plant; sim: SimResult }) {
  const base = 262;
  const step = 110;
  const blocks = plant.stations.map((s, i) => {
    const u = sim.stationStats[s.id].utilization;
    const x = 40 + i * step;
    const h = 10 + Math.max(0, Math.min(1, u)) * 150;
    return { s, u, x, h, top: base - h, hold: s.id === sim.bottleneckStationId };
  });
  const centerline =
    `M8,${blocks[0].top + 4} L` +
    blocks.map((b) => `${b.x + 42},${b.top}`).join(" L") +
    ` L712,${blocks[blocks.length - 1].top + 6}`;

  return (
    <svg
      viewBox="0 0 720 348"
      role="img"
      aria-label={`Line elevation. ${blocks
        .map((b) => `${b.s.id} ${b.s.name} ${fmtPct(b.u)} busy${b.hold ? ", bottleneck" : ""}`)
        .join(". ")}.`}
    >
      <path className="g-center" d={centerline} />
      {blocks.map((b) => {
        const { x, top } = b;
        const leaderY = top - 42;
        return (
          <g key={b.s.id} className={b.hold ? "g-hold" : undefined}>
            <polygon
              className="g-face-l"
              points={`${x},${top} ${x + 34},${top + 16} ${x + 34},${base + 16} ${x},${base}`}
            />
            <polygon
              className="g-face-r"
              points={`${x + 34},${top + 16} ${x + 84},${top} ${x + 84},${base} ${x + 34},${base + 16}`}
            />
            <polygon
              className="g-face-t"
              points={`${x},${top} ${x + 50},${top - 16} ${x + 84},${top} ${x + 34},${top + 16}`}
            />
            {b.hold && <circle className="g-halo" cx={x + 42} cy={top} r={22} />}
            <path className="g-leader" d={`M${x + 42},${top - 4} L${x + 54},${leaderY + 6} h36`} />
            <text className="g-value" x={x + 56} y={leaderY}>
              {fmtPct(b.u)}
            </text>
            {/* One word per line, so long names never run into the next block. */}
            <text className="g-label" x={x} y={base + 36}>
              {[b.s.id, ...b.s.name.toUpperCase().split(" "), ...(b.hold ? ["BOTTLENECK"] : [])].map(
                (word, k) => (
                  <tspan key={k} x={x} dy={k === 0 ? 0 : 14}>
                    {word}
                  </tspan>
                ),
              )}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Detail C. Good units per scheduled hour against the hourly plan at takt.
export function HourBoard({
  sim,
  shift,
}: {
  sim: SimResult;
  shift: ShiftPattern;
}) {
  const hours = sim.goodByHour;
  const plan = sim.analytical.plantDemandPerHour;
  const x0 = 56;
  const x1 = 706;
  const y0 = 206;
  const top = 26;
  const max = Math.max(plan, ...hours, 1) * 1.12;
  const y = (v: number) => y0 - (v / max) * (y0 - top);
  const w = hours.length > 0 ? (x1 - x0) / hours.length : 0;
  const pad = Math.min(6, w * 0.12);
  const ticks = [0, 0.5, 1].map((f) => Math.round((plan * f) / 10) * 10);

  return (
    <svg
      viewBox="0 0 720 250"
      role="img"
      aria-label={`Good units per hour: ${hours.map(fmtInt).join(", ")}. Plan at takt is ${fmtInt(plan)} per hour.`}
    >
      {ticks.map((v) => (
        <g key={v}>
          <path className="g-grid" d={`M${x0},${y(v)} H${x1}`} />
          <text className="g-dim" x={x0 - 8} y={y(v) + 4} textAnchor="end">
            {fmtInt(v)}
          </text>
        </g>
      ))}
      {hours.map((v, i) => {
        const x = x0 + i * w + pad;
        const bw = w - pad * 2;
        return (
          <g key={i}>
            <rect className="g-bar" x={x} y={y(v)} width={bw} height={y0 - y(v)} />
            <text className="g-label" x={x + bw / 2} y={y(v) - 6} textAnchor="middle">
              {fmtInt(v)}
            </text>
            <text className="g-dim" x={x + bw / 2} y={y0 + 16} textAnchor="middle">
              {hourLabel(shift, i)}
            </text>
          </g>
        );
      })}
      <path className="g-axis" d={`M${x0},${top - 8} V${y0} H${x1}`} />
      <path className="g-plan" d={`M${x0},${y(plan)} H${x1}`} />
      <text className="g-label g-flag" x={x1} y={y(plan) - 7} textAnchor="end">
        PLAN AT TAKT {fmtInt(plan)} PER HOUR
      </text>
      <text className="g-dim" x={x0} y={y0 + 34}>
        HOUR STARTING
      </text>
    </svg>
  );
}

interface Run {
  state: MachineState;
  start: number;
  length: number;
}

function toRuns(row: MachineState[]): Run[] {
  const runs: Run[] = [];
  row.forEach((state, i) => {
    const last = runs[runs.length - 1];
    if (last && last.state === state) last.length++;
    else runs.push({ state, start: i, length: 1 });
  });
  return runs;
}

// Detail E. State of each station on line 1 across the shift. Down is a full
// height mark, blocked is a half height mark, so the two differ by shape as
// well as by color.
export function StateTimeline({
  plant,
  sim,
  shift,
}: {
  plant: Plant;
  sim: SimResult;
  shift: ShiftPattern;
}) {
  const { rows, binSeconds } = sim.stateTimeline;
  const x0 = 160;
  const x1 = 1108;
  const rowH = 22;
  const gap = 6;
  const bins = Math.max(1, Math.ceil(sim.scheduledSeconds / binSeconds));
  const xs = (bin: number) => x0 + (bin / bins) * (x1 - x0);
  const bottom = 8 + plant.stations.length * (rowH + gap);
  const hours = Math.floor(sim.scheduledSeconds / 3600);
  const height = bottom + 30;

  return (
    <svg
      className="g-timeline"
      viewBox={`0 0 1120 ${height}`}
      role="img"
      aria-label="State of each station on line 1 across the shift: running, blocked, or down."
    >
      {plant.stations.map((s, i) => {
        const y = 8 + i * (rowH + gap);
        const hold = s.id === sim.bottleneckStationId;
        return (
          <g key={s.id}>
            <text className={hold ? "g-label g-flag" : "g-label"} x={0} y={y + 15}>
              {s.id} {s.name.toUpperCase()}
            </text>
            <rect className="g-track" x={x0} y={y} width={x1 - x0} height={rowH} />
            {toRuns(rows[s.id] ?? []).map((run) => {
              if (run.state === "idle") return null;
              const x = xs(run.start);
              const width = Math.max(1, xs(run.start + run.length) - x);
              if (run.state === "blocked") {
                return (
                  <rect key={run.start} className="g-blocked" x={x} y={y + 6} width={width} height={rowH - 12} />
                );
              }
              return (
                <rect
                  key={run.start}
                  className={run.state === "down" ? "g-down" : "g-run"}
                  x={x}
                  y={y}
                  width={width}
                  height={rowH}
                />
              );
            })}
          </g>
        );
      })}
      {Array.from({ length: hours + 1 }, (_, h) => {
        const x = xs((h * 3600) / binSeconds);
        return (
          <g key={h}>
            <path className="g-axis" d={`M${x},${bottom - 2} v6`} />
            <text className="g-dim" x={x} y={bottom + 20} textAnchor="middle">
              {hourLabel(shift, h)}:00
            </text>
          </g>
        );
      })}
    </svg>
  );
}
