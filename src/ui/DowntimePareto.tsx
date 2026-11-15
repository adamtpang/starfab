import { fmtInt, fmtMinutes, fmtPct, REASON_LABELS } from "../lib/format";
import type { SimResult } from "../types";
import { DOWNTIME_REASONS } from "../types";
import { Assumption } from "./Tag";

// Downtime Pareto by reason, largest first, with a cumulative share.
export function DowntimePareto({ sim }: { sim: SimResult }) {
  const rows = DOWNTIME_REASONS.map((reason) => ({ reason, ...sim.downtimeByReason[reason] }))
    .sort((a, b) => b.seconds - a.seconds);
  const total = rows.reduce((acc, r) => acc + r.seconds, 0);
  const max = rows[0]?.seconds ?? 0;
  let running = 0;

  return (
    <section className="panel" aria-labelledby="pareto-h">
      <div className="panel-head">
        <h2 id="pareto-h">Downtime Pareto</h2>
        <p className="panel-note">
          Machine minutes by reason, all lines and stations. Reason labels{" "}
          <Assumption id="A18" />, event length <Assumption id="A17" />.
        </p>
      </div>
      {total <= 0 ? (
        <p className="empty">No downtime in this shift. Availability is 1.00 at every station.</p>
      ) : (
        <div className="table-scroll">
          <table className="pareto">
            <thead>
              <tr>
                <th scope="col">Reason</th>
                <th scope="col" className="bar-col">Share of downtime</th>
                <th scope="col" className="num">Minutes</th>
                <th scope="col" className="num">Events</th>
                <th scope="col" className="num">Share</th>
                <th scope="col" className="num">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                running += r.share;
                return (
                  <tr key={r.reason}>
                    <th scope="row">{REASON_LABELS[r.reason]}</th>
                    <td className="bar-col">
                      <div className="stack">
                        <span
                          className="seg seg-down"
                          style={{ width: `${max > 0 ? (r.seconds / max) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className="num">{fmtMinutes(r.seconds)}</td>
                    <td className="num">{fmtInt(r.events)}</td>
                    <td className="num">{fmtPct(r.share)}</td>
                    <td className="num">{fmtPct(running)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td />
                <td className="num">{fmtMinutes(total)}</td>
                <td className="num">{fmtInt(sim.downtimeEvents.length)}</td>
                <td className="num">100.0%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
