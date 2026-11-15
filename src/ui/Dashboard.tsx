import type { ReactNode } from "react";
import { DEMAND_CITATIONS, DEMAND_DATE, SHIFT_CITATION } from "../citations";
import { fmtClock, fmtHours, fmtInt, fmtNum, fmtPct, fmtSigned } from "../lib/format";
import type { CrewId, Plant, SimResult } from "../types";
import { HourBoard, LineElevation, StateTimeline } from "./Charts";
import { Detail } from "./Detail";
import { DowntimePareto } from "./DowntimePareto";
import { StationTable } from "./StationTable";
import { Assumption, Derived, ModelOutput, Sourced } from "./Tag";

function Kpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: ReactNode;
  tone?: "behind" | "ahead";
}) {
  return (
    <div className={tone ? `kpi kpi-${tone}` : "kpi"}>
      <span className="cell-label">{label}</span>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}

function Figure({ label, value, tag }: { label: string; value: string; tag: ReactNode }) {
  return (
    <div className="figure">
      <dt>{label}</dt>
      <dd>
        <b>{value}</b>
        {tag}
      </dd>
    </div>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div className="gauge">
      <span className="cell-label">{label}</span>
      <div className="gauge-track" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      </div>
      <b>{fmtPct(value)}</b>
    </div>
  );
}

export function Dashboard({
  plant,
  sim,
  crew,
  onCrew,
}: {
  plant: Plant;
  sim: SimResult;
  crew: CrewId;
  onCrew: (crew: CrewId) => void;
}) {
  const shift = plant.shifts.find((s) => s.crew === crew) ?? plant.shifts[0];
  const constraint =
    plant.stations.find((s) => s.id === sim.bottleneckStationId) ?? plant.stations[0];
  const cs = sim.stationStats[constraint.id];
  const machines = plant.parallelLines * constraint.parallelUnits;
  const behind = sim.aheadOrBehind < 0;
  const a = sim.analytical;
  const lineWord = plant.parallelLines === 1 ? "line" : "lines";
  const derived = <Derived>derived from sourced demand plus assumptions</Derived>;

  return (
    <div className="sheet">
      <div className="titleblock">
        <div className="tb-cell">
          <span className="cell-label">TITLE</span>
          <b>Shift record</b>
        </div>
        <div className="tb-cell tb-crew">
          <span className="cell-label" id="crew-label">
            CREW <Assumption id="A1" />
          </span>
          <div className="crew-buttons" role="group" aria-labelledby="crew-label">
            {plant.shifts.map((s) => (
              <button
                key={s.crew}
                type="button"
                className={s.crew === crew ? "crew-btn active" : "crew-btn"}
                aria-pressed={s.crew === crew}
                aria-label={`Crew ${s.crew}`}
                onClick={() => onCrew(s.crew)}
              >
                {s.crew}
              </button>
            ))}
          </div>
        </div>
        <div className="tb-cell">
          <span className="cell-label">CLOCK</span>
          <b>
            {fmtClock(shift.startClock)} to {fmtClock(shift.endClock)}
          </b>
        </div>
        <div className="tb-cell">
          <span className="cell-label">
            LINES <Assumption id="A7" />
          </span>
          <b>{plant.parallelLines}</b>
        </div>
        <div className="tb-cell">
          <span className="cell-label">LINE TAKT</span>
          <b>{fmtNum(sim.lineTaktSeconds, 2)} s</b>
        </div>
        <div className={behind ? "tb-cell tb-behind" : "tb-cell tb-ahead"}>
          <span className="cell-label">STATUS</span>
          <b className="status">{behind ? "Behind takt" : "At or ahead of takt"}</b>
        </div>
      </div>

      <div className="kpis">
        <Kpi
          label="AHEAD OR BEHIND"
          value={fmtSigned(sim.aheadOrBehind)}
          note="good units minus planned at takt"
          tone={behind ? "behind" : "ahead"}
        />
        <Kpi
          label="UNITS GOOD"
          value={fmtInt(sim.unitsGood)}
          note={`${fmtNum(sim.throughputGoodPerHour, 0)} good per hour`}
        />
        <Kpi
          label="PLANNED AT TAKT"
          value={fmtInt(sim.plannedUnitsAtTakt)}
          note={`${fmtInt(a.plantDemandPerHour)} per hour, all ${lineWord}`}
        />
        <Kpi
          label="SCRAP"
          value={fmtInt(sim.unitsScrap)}
          note={`observed yield ${fmtPct(sim.yieldObserved)}`}
        />
        <Kpi
          label="END OF SHIFT WIP"
          value={fmtInt(sim.wipEnd)}
          note={`average WIP ${fmtNum(sim.wipAverage, 1)}`}
        />
      </div>

      <div className="details">
        <Detail letter="A" title="Line elevation" note="block height is utilization" span="wide">
          <LineElevation plant={plant} sim={sim} />
          <p className="fine">
            The bottleneck is the station with the lowest stand-alone good-unit rate (capacity
            times yield), upstream station on a tie. With identical stations that is S1. Six
            generic stations in series <Assumption id="A8" />.
          </p>
        </Detail>

        <Detail letter="B" title="OEE" note="model outputs, not factory KPIs">
          <div className="gauges">
            <Gauge label="AVAILABILITY" value={sim.oee.availability} />
            <Gauge label="PERFORMANCE" value={sim.oee.performance} />
            <Gauge label="QUALITY" value={sim.oee.quality} />
            <div className="gauge-total">
              <span className="cell-label">OEE AT THE CONSTRAINT</span>
              <b>{fmtPct(sim.oee.oee)}</b>
            </div>
          </div>
          <p className="fine">
            Performance compares pack-out completions at the engineered cycle with the up time of
            the constraint, so upstream scrap and blocking pull it below the 0.95 pace{" "}
            <Assumption id="A13" />.
          </p>
        </Detail>

        <Detail letter="C" title="Hour by hour" note="good units against plan" span="wide">
          <HourBoard sim={sim} shift={shift} />
        </Detail>

        <DowntimePareto sim={sim} />

        <Detail
          letter="E"
          title="Station states"
          note={`line 1 of ${plant.parallelLines}, one mark per minute`}
          span="full"
        >
          <div className="legend" aria-hidden="true">
            <span>
              <i className="sw sw-run" /> running
            </span>
            <span>
              <i className="sw sw-down" /> down
            </span>
            <span>
              <i className="sw sw-blocked" /> blocked
            </span>
            <span>
              <i className="sw sw-idle" /> idle or starved
            </span>
          </div>
          <div className="scroll-x">
            <StateTimeline plant={plant} sim={sim} shift={shift} />
          </div>
          <p className="fine">
            With no buffers between stations <Assumption id="A14" />, a station that goes down
            soon blocks everything upstream and starves everything downstream. Downtime events
            are about 15 minutes each <Assumption id="A17" />.
          </p>
        </Detail>

        <StationTable plant={plant} sim={sim} />

        <Detail letter="G" title="Shift figures" span="full">
          <dl className="figures">
            <Figure label="Units started" value={fmtInt(sim.unitsStarted)} tag={<ModelOutput />} />
            <Figure
              label="Units completed"
              value={fmtInt(sim.unitsCompleted)}
              tag={<ModelOutput />}
            />
            <Figure
              label="Observed yield"
              value={fmtPct(sim.yieldObserved)}
              tag={<ModelOutput />}
            />
            <Figure
              label="Good per start"
              value={fmtPct(sim.yieldFromStarts)}
              tag={<ModelOutput />}
            />
            <Figure
              label="Theoretical RTY"
              value={fmtPct(sim.rtyTheoretical)}
              tag={<Derived>product of station yields</Derived>}
            />
            <Figure
              label="Scheduled time"
              value={`${fmtHours(sim.scheduledSeconds, 1)} h`}
              tag={<Assumption id="A2" />}
            />
            <Figure
              label="Constraint runtime"
              value={`${fmtHours(machines > 0 ? cs.uptimeSeconds / machines : 0)} h`}
              tag={<ModelOutput />}
            />
            <Figure
              label="Constraint downtime"
              value={`${fmtHours(machines > 0 ? cs.downtimeSeconds / machines : 0)} h`}
              tag={<ModelOutput />}
            />
            <Figure label="Line takt" value={`${fmtNum(sim.lineTaktSeconds, 2)} s`} tag={derived} />
            <Figure
              label="Planned at takt"
              value={fmtInt(sim.plannedUnitsAtTakt)}
              tag={derived}
            />
            <Figure label="Average WIP" value={fmtNum(sim.wipAverage, 1)} tag={<ModelOutput />} />
            <Figure
              label="Analytical good units"
              value={fmtInt(a.unitsGood)}
              tag={<Derived>rate model</Derived>}
            />
          </dl>
          <p className="fine">
            <strong>Crew {shift.crew}</strong>, {fmtClock(shift.startClock)} to{" "}
            {fmtClock(shift.endClock)}, {shift.daysNote}.{" "}
            <Sourced>
              sourced: <a href={SHIFT_CITATION.url}>{SHIFT_CITATION.title}</a>,{" "}
              {SHIFT_CITATION.date}
            </Sourced>{" "}
            A {shift.mealBreakMinutes} minute meal break inside the 12.5 hour span is{" "}
            <Assumption id="A2" />. Coverage is 24 hours, 365 days <Assumption id="A3" />. Every
            crew runs the same production hours, so totals do not change with the crew.
          </p>
          <p className="fine">
            Demand: {fmtInt(plant.annualDemandKits)} kits per year
            {plant.annualDemandKits === 10000000 ? (
              <>
                , from a public statement of a target of 10 million kits per year by the end of
                2026 ({DEMAND_DATE}):{" "}
                {DEMAND_CITATIONS.map((c, i) => (
                  <span key={c.url}>
                    {i > 0 && ", "}
                    <a href={c.url}>{c.title}</a>
                  </span>
                ))}
                . Using it as plant-wide demand is <Assumption id="A4" />, one kit is one finished
                unit <Assumption id="A5" />, spread evenly over the year <Assumption id="A6" />.
              </>
            ) : (
              <>
                {" "}
                is a what-if value. The public figure is 10 million kits per year by the end of
                2026 ({DEMAND_DATE}):{" "}
                <a href={DEMAND_CITATIONS[0].url}>{DEMAND_CITATIONS[0].title}</a>.
              </>
            )}
          </p>
          <p className="fine">
            Analytical capacity (rate model, no blocking, no leftover WIP) gives{" "}
            {fmtInt(a.unitsGood)} good units, {fmtSigned(a.aheadOrBehind)} versus takt. The
            simulated shift lands at or below this. With no buffers <Assumption id="A14" />, six
            separate downtime budgets stack up instead of overlapping. Cycle times also round up
            to whole 1 second ticks <Assumption id="A15" />, unfinished units stay on the line as
            WIP <Assumption id="A19" />, and S1 starts a unit whenever it is free{" "}
            <Assumption id="A20" />.
          </p>
        </Detail>
      </div>
    </div>
  );
}
