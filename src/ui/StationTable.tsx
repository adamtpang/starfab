import { fmtInt, fmtMinutes, fmtNum, fmtPct } from "../lib/format";
import type { Plant, SimResult } from "../types";
import { Assumption } from "./Tag";

// Station utilization. Busy, blocked, down, and idle are separate segments.
// The bottleneck row gets an accent border and a text label, never a logo.
export function StationTable({ plant, sim }: { plant: Plant; sim: SimResult }) {
  const lines = plant.parallelLines;
  return (
    <section className="panel" aria-labelledby="stations-h">
      <div className="panel-head">
        <h2 id="stations-h">Station utilization</h2>
        <p className="panel-note">
          Share of scheduled machine time, all {lines} {lines === 1 ? "line" : "lines"} combined.
        </p>
      </div>
      <div className="legend" aria-hidden="true">
        <span><i className="sw sw-busy" /> busy</span>
        <span><i className="sw sw-blocked" /> blocked</span>
        <span><i className="sw sw-down" /> down</span>
        <span><i className="sw sw-idle" /> idle or starved</span>
      </div>
      <div className="table-scroll">
        <table className="stations">
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col" className="num">Cycle <Assumption id="A9" /></th>
              <th scope="col" className="num">Yield <Assumption id="A11" /></th>
              <th scope="col" className="num">Avail. <Assumption id="A12" /></th>
              <th scope="col" className="bar-col">Utilization</th>
              <th scope="col" className="num">Blocked</th>
              <th scope="col" className="num">Down</th>
              <th scope="col" className="num">Good out</th>
            </tr>
          </thead>
          <tbody>
            {plant.stations.map((s) => {
              const st = sim.stationStats[s.id];
              const total = lines * s.parallelUnits * sim.scheduledSeconds;
              const share = (x: number) => (total > 0 ? (x / total) * 100 : 0);
              const isBottleneck = s.id === sim.bottleneckStationId;
              return (
                <tr key={s.id} className={isBottleneck ? "bottleneck" : undefined}>
                  <th scope="row">
                    <span className="station-id">{s.id}</span> {s.name}
                    {isBottleneck && <span className="bottleneck-label">bottleneck</span>}
                  </th>
                  <td className="num">{fmtNum(s.cycleTimeSeconds, 1)} s</td>
                  <td className="num">{fmtNum(s.firstPassYield, 2)}</td>
                  <td className="num">{fmtNum(s.availability, 2)}</td>
                  <td className="bar-col">
                    <div
                      className="stack"
                      role="img"
                      aria-label={`${s.name}: busy ${fmtPct(st.utilization)}, blocked ${fmtNum(share(st.blockedSeconds))}%, down ${fmtNum(share(st.downtimeSeconds))}%`}
                    >
                      <span className="seg seg-busy" style={{ width: `${share(st.busySeconds)}%` }} />
                      <span className="seg seg-blocked" style={{ width: `${share(st.blockedSeconds)}%` }} />
                      <span className="seg seg-down" style={{ width: `${share(st.downtimeSeconds)}%` }} />
                    </div>
                    <span className="stack-value">{fmtPct(st.utilization)}</span>
                  </td>
                  <td className="num">{fmtMinutes(st.blockedSeconds)} min</td>
                  <td className="num">{fmtMinutes(st.downtimeSeconds)} min</td>
                  <td className="num">{fmtInt(st.outflowGood)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fine">
        The bottleneck is the station with the lowest stand-alone good-unit rate (capacity times
        yield), upstream station on a tie. With identical stations that is S1. Blocked and down
        minutes are machine minutes summed across lines. Performance is 0.95 at every station{" "}
        <Assumption id="A13" />, with 1 machine and 1 operator per station <Assumption id="A10" />.
      </p>
    </section>
  );
}
