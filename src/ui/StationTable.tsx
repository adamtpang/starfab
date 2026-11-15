import { fmtInt, fmtMinutes, fmtNum, fmtPct } from "../lib/format";
import { stationSourceId } from "../plant";
import type { Plant, SimResult } from "../types";
import { Detail } from "./Detail";
import { Assumption } from "./Tag";

// Detail H. Station utilization. Busy, blocked, and down are separate
// segments. The bottleneck row gets a border and a text label, never a logo.
export function StationTable({ plant, sim }: { plant: Plant; sim: SimResult }) {
  const lines = plant.parallelLines;
  return (
    <Detail
      letter="H"
      title="Station utilization"
      note={`share of scheduled machine time, all ${lines} ${lines === 1 ? "line" : "lines"}`}
      span="full"
    >
      <div className="legend" aria-hidden="true">
        <span>
          <i className="sw sw-run" /> busy
        </span>
        <span>
          <i className="sw sw-blocked" /> blocked
        </span>
        <span>
          <i className="sw sw-down" /> down
        </span>
        <span>
          <i className="sw sw-idle" /> idle or starved
        </span>
      </div>
      <div className="scroll-x">
        <table className="stations">
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col" className="num">
                Cycle <Assumption id={stationSourceId(plant, "cycleTimeSeconds", "A9")} />
              </th>
              <th scope="col" className="num">
                Yield <Assumption id={stationSourceId(plant, "firstPassYield", "A11")} />
              </th>
              <th scope="col" className="num">
                Avail. <Assumption id={stationSourceId(plant, "availability", "A12")} />
              </th>
              <th scope="col" className="num">
                Tools <Assumption id={stationSourceId(plant, "parallelUnits", "A10")} />
              </th>
              <th scope="col" className="bar-col">
                Utilization
              </th>
              <th scope="col" className="num">
                Blocked
              </th>
              <th scope="col" className="num">
                Down
              </th>
              <th scope="col" className="num">
                Good out
              </th>
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
                  <td className="num">{s.parallelUnits * lines}</td>
                  <td className="bar-col">
                    <div
                      className="stack"
                      role="img"
                      aria-label={`${s.name}: busy ${fmtPct(st.utilization)}, blocked ${fmtNum(share(st.blockedSeconds))}%, down ${fmtNum(share(st.downtimeSeconds))}%`}
                    >
                      <span className="seg seg-busy" style={{ width: `${share(st.busySeconds)}%` }} />
                      <span
                        className="seg seg-blocked"
                        style={{ width: `${share(st.blockedSeconds)}%` }}
                      />
                      <span
                        className="seg seg-down"
                        style={{ width: `${share(st.downtimeSeconds)}%` }}
                      />
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
        Blocked and down minutes are machine minutes summed across lines. Tools is the machine
        count at that station across all lines. Performance is 0.95 at every station{" "}
        <Assumption id={stationSourceId(plant, "performance", "A13")} />.
      </p>
    </Detail>
  );
}
