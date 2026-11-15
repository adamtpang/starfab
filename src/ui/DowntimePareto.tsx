import { fmtInt, fmtMinutes, fmtPct, REASON_LABELS } from "../lib/format";
import type { SimResult } from "../types";
import { DOWNTIME_REASONS } from "../types";
import { Detail } from "./Detail";
import { Assumption } from "./Tag";

// Short axis labels. The table under the chart has the full names.
const SHORT_LABELS: Record<string, string> = {
  breakdown: "BREAK",
  changeover: "CHANGE",
  material_wait: "MATL",
  quality_hold: "QUAL",
};

// Detail D. Downtime Pareto by reason, largest first, with a cumulative line.
export function DowntimePareto({ sim }: { sim: SimResult }) {
  const rows = DOWNTIME_REASONS.map((reason) => ({ reason, ...sim.downtimeByReason[reason] }))
    .sort((a, b) => b.seconds - a.seconds);
  const total = rows.reduce((acc, r) => acc + r.seconds, 0);
  const max = rows[0]?.seconds ?? 0;

  const x0 = 44;
  const x1 = 332;
  const y0 = 150;
  const top = 18;
  const w = (x1 - x0) / rows.length;
  let running = 0;
  const points = rows.map((r, i) => {
    running += r.share;
    return { x: x0 + i * w + w / 2, y: y0 - running * (y0 - top), cumulative: running };
  });

  return (
    <Detail letter="D" title="Downtime Pareto" note="machine minutes, all lines">
      {total <= 0 ? (
        <p className="empty">No downtime in this shift. Availability is 1.00 at every station.</p>
      ) : (
        <>
          <svg className="g-compact" viewBox="0 0 340 172" role="img" aria-label="Downtime by reason with cumulative share. The table below has the same figures.">
            {rows.map((r, i) => {
              const h = max > 0 ? (r.seconds / max) * (y0 - top) * 0.82 : 0;
              return (
                <g key={r.reason}>
                  <rect className="g-bar g-bar-down" x={x0 + i * w + 8} y={y0 - h} width={w - 16} height={h} />
                  <text className="g-dim" x={x0 + i * w + w / 2} y={y0 + 15} textAnchor="middle">
                    {SHORT_LABELS[r.reason]}
                  </text>
                </g>
              );
            })}
            <path className="g-axis" d={`M${x0},${top - 6} V${y0} H${x1}`} />
            <path className="g-cum" d={"M" + points.map((p) => `${p.x},${p.y}`).join(" L")} />
            {points.map((p, i) => (
              <g key={i}>
                <circle className="g-dot" cx={p.x} cy={p.y} r={3.5} />
                <text className="g-label" x={p.x - 8} y={p.y - 7} textAnchor="end">
                  {fmtPct(p.cumulative, 0)}
                </text>
              </g>
            ))}
          </svg>
          <div className="scroll-x">
            <table className="pareto">
              <thead>
                <tr>
                  <th scope="col">Reason</th>
                  <th scope="col" className="num">Min</th>
                  <th scope="col" className="num">Events</th>
                  <th scope="col" className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reason}>
                    <th scope="row">{REASON_LABELS[r.reason]}</th>
                    <td className="num">{fmtMinutes(r.seconds)}</td>
                    <td className="num">{fmtInt(r.events)}</td>
                    <td className="num">{fmtPct(r.share)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="num">{fmtMinutes(total)}</td>
                  <td className="num">{fmtInt(sim.downtimeEvents.length)}</td>
                  <td className="num">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
      <p className="fine">
        Reason labels <Assumption id="A18" />, event length <Assumption id="A17" />. The line is
        the cumulative share.
      </p>
    </Detail>
  );
}
