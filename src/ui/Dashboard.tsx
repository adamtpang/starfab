import type { ReactNode } from "react";
import { DEMAND_CITATIONS, DEMAND_DATE, SHIFT_CITATION } from "../citations";
import { fmtClock, fmtHours, fmtInt, fmtNum, fmtPct, fmtSigned } from "../lib/format";
import type { CrewId, Plant, SimResult } from "../types";
import { DowntimePareto } from "./DowntimePareto";
import { StationTable } from "./StationTable";
import { Assumption, Derived, ModelOutput, Sourced } from "./Tag";

function Card({
  label,
  value,
  unit,
  tag,
  note,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tag?: ReactNode;
  note?: ReactNode;
  tone?: "behind" | "ahead";
}) {
  return (
    <div className={tone ? `card card-${tone}` : "card"}>
      <div className="card-label">{label}</div>
      <div className="card-value">
        {value}
        {unit && <span className="card-unit"> {unit}</span>}
      </div>
      {tag && <div className="card-tag">{tag}</div>}
      {note && <div className="card-note">{note}</div>}
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
  const derivedTag = <Derived>derived from sourced demand plus assumptions</Derived>;

  return (
    <div className="dashboard">
      <section className="panel crew" aria-labelledby="crew-h">
        <div className="panel-head">
          <h2 id="crew-h">Shift</h2>
          <div className="crew-buttons" role="group" aria-label="Crew">
            {plant.shifts.map((s) => (
              <button
                key={s.crew}
                type="button"
                className={s.crew === crew ? "crew-btn active" : "crew-btn"}
                aria-pressed={s.crew === crew}
                onClick={() => onCrew(s.crew)}
              >
                Crew {s.crew}
              </button>
            ))}
          </div>
        </div>
        <p className="crew-line">
          <strong>Crew {shift.crew}</strong>, {fmtClock(shift.startClock)} to{" "}
          {fmtClock(shift.endClock)}, {shift.daysNote}.{" "}
          <Sourced>
            sourced: <a href={SHIFT_CITATION.url}>{SHIFT_CITATION.title}</a>, {SHIFT_CITATION.date}
          </Sourced>
        </p>
        <p className="fine">
          Applying the posted A/B/C/D pattern to this teaching line is <Assumption id="A1" />. A{" "}
          {shift.mealBreakMinutes} minute meal break inside the 12.5 hour span is{" "}
          <Assumption id="A2" />. Coverage is 24 hours, 365 days <Assumption id="A3" />. Every crew
          runs the same production hours, so totals do not change with the crew.
        </p>
      </section>

      <section className="panel" aria-labelledby="yield-h">
        <div className="panel-head">
          <h2 id="yield-h">Shift yield</h2>
          <p className={behind ? "status status-behind" : "status status-ahead"}>
            {behind ? "Behind takt" : "At or ahead of takt"}
          </p>
        </div>
        <div className="cards">
          <Card
            label="Ahead or behind"
            value={fmtSigned(sim.aheadOrBehind)}
            unit="units"
            tone={behind ? "behind" : "ahead"}
            tag={<ModelOutput />}
            note="good units minus planned units at takt"
          />
          <Card
            label="Units good"
            value={fmtInt(sim.unitsGood)}
            tag={<ModelOutput />}
            note={`${fmtNum(sim.throughputGoodPerHour, 1)} good per hour`}
          />
          <Card
            label="Planned at takt"
            value={fmtInt(sim.plannedUnitsAtTakt)}
            unit="units"
            tag={derivedTag}
          />
          <Card
            label="Line takt"
            value={fmtNum(sim.lineTaktSeconds, 2)}
            unit="s"
            tag={derivedTag}
            note={`${fmtInt(plant.annualDemandKits)} kits per year across ${plant.parallelLines} ${lineWord}`}
          />
          <Card label="Units started" value={fmtInt(sim.unitsStarted)} tag={<ModelOutput />} />
          <Card
            label="Units completed"
            value={fmtInt(sim.unitsCompleted)}
            tag={<ModelOutput />}
            note="reached pack-out, good or scrap"
          />
          <Card
            label="Scrap"
            value={fmtInt(sim.unitsScrap)}
            unit="units"
            tag={<ModelOutput />}
            note="all stations, no rework"
          />
          <Card
            label="Observed yield"
            value={fmtPct(sim.yieldObserved)}
            tag={<ModelOutput />}
            note={`good per start ${fmtPct(sim.yieldFromStarts)}`}
          />
          <Card
            label="Theoretical RTY"
            value={fmtPct(sim.rtyTheoretical)}
            tag={<Derived>product of station yields</Derived>}
          />
          <Card
            label="Scheduled time"
            value={fmtHours(sim.scheduledSeconds, 1)}
            unit="h"
            tag={<Assumption id="A2" />}
            note="planned production time"
          />
          <Card
            label="Constraint runtime"
            value={fmtHours(machines > 0 ? cs.uptimeSeconds / machines : 0)}
            unit="h"
            tag={<ModelOutput />}
            note={`${constraint.id} ${constraint.name}, per machine`}
          />
          <Card
            label="Constraint downtime"
            value={fmtHours(machines > 0 ? cs.downtimeSeconds / machines : 0)}
            unit="h"
            tag={<ModelOutput />}
            note={`${constraint.id} ${constraint.name}, per machine`}
          />
        </div>
        <p className="fine cite">
          Demand: {fmtInt(plant.annualDemandKits)} kits per year
          {plant.annualDemandKits === 10000000 ? (
            <>
              , from a public statement of a target of 10 million kits per year by the end of 2026
              ({DEMAND_DATE}):{" "}
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
              is a what-if value. The public figure is 10 million kits per year by the end of 2026
              ({DEMAND_DATE}): <a href={DEMAND_CITATIONS[0].url}>{DEMAND_CITATIONS[0].title}</a>.
            </>
          )}
        </p>
        <p className="fine">
          Analytical capacity (rate model, no blocking, no leftover WIP): {fmtInt(a.unitsGood)}{" "}
          good units, {fmtSigned(a.aheadOrBehind)} versus takt. The simulated shift lands at or
          below this. With no buffers <Assumption id="A14" />, an outage at any one station soon
          blocks or starves the whole line, so six separate downtime budgets stack up instead of
          overlapping. Cycle times also round up to whole 1 second ticks <Assumption id="A15" />,
          and unfinished units stay on the line.
        </p>
      </section>

      <div className="split">
        <section className="panel" aria-labelledby="oee-h">
          <div className="panel-head">
            <h2 id="oee-h">OEE</h2>
            <p className="panel-note">Model outputs at the constraint, not factory KPIs.</p>
          </div>
          <div className="cards cards-4">
            <Card label="Availability" value={fmtPct(sim.oee.availability)} />
            <Card label="Performance" value={fmtPct(sim.oee.performance)} />
            <Card label="Quality" value={fmtPct(sim.oee.quality)} />
            <Card label="OEE" value={fmtPct(sim.oee.oee)} />
          </div>
          <p className="fine">
            Performance compares pack-out completions at the engineered cycle with the up time of
            the constraint, so upstream scrap and blocking pull it below the 0.95 pace{" "}
            <Assumption id="A13" />.
          </p>
        </section>

        <section className="panel" aria-labelledby="wip-h">
          <div className="panel-head">
            <h2 id="wip-h">WIP</h2>
            <p className="panel-note">Units on the lines.</p>
          </div>
          <div className="cards cards-2">
            <Card
              label="Average WIP"
              value={fmtNum(sim.wipAverage, 1)}
              unit="units"
              tag={<ModelOutput />}
            />
            <Card
              label="End of shift WIP"
              value={fmtInt(sim.wipEnd)}
              unit="units"
              tag={<ModelOutput />}
            />
          </div>
          <p className="fine">
            Buffers between stations are assumed to be zero <Assumption id="A14" />, so WIP can
            never exceed one unit per machine. Unfinished units at the end of the shift count as
            WIP <Assumption id="A19" />. S1 starts a unit whenever it is free{" "}
            <Assumption id="A20" />.
          </p>
        </section>
      </div>

      <StationTable plant={plant} sim={sim} />
      <DowntimePareto sim={sim} />
    </div>
  );
}
