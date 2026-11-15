import type { ReactNode } from "react";
import { LEVER_LIMITS } from "../applyLevers";
import type { Station, StationId } from "../types";
import { Assumption, Sourced } from "./Tag";

export type LeverKey =
  | "parallelLines"
  | "annualDemandKits"
  | "cycleTimeMultiplier"
  | "firstPassYield"
  | "availability"
  | "scheduledHours"
  | "bufferCapacity"
  | "seed";

export type LeverInputs = Record<LeverKey, string>;
export type StationField = "cycle" | "yield" | "availability";
export type StationInputs = Record<StationId, Record<StationField, string>>;

const STATION_FIELDS: StationField[] = ["cycle", "yield", "availability"];

function Row({
  id,
  label,
  tag,
  hint,
  children,
}: {
  id: string;
  label: string;
  tag: ReactNode;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="lever">
      <div className="lever-top">
        <label htmlFor={id}>{label}</label>
        {tag}
      </div>
      <div className="lever-control">{children}</div>
      <p className="lever-hint">{hint}</p>
    </div>
  );
}

export function Levers({
  inputs,
  onChange,
  stations,
  stationInputs,
  onStationChange,
  notes,
  onReset,
  dirty,
}: {
  inputs: LeverInputs;
  onChange: (key: LeverKey, value: string) => void;
  stations: Station[];
  stationInputs: StationInputs;
  onStationChange: (id: StationId, field: StationField, value: string) => void;
  notes: string[];
  onReset: () => void;
  dirty: boolean;
}) {
  const L = LEVER_LIMITS;

  const number = (key: LeverKey, step: number, min?: number, max?: number) => (
    <input
      id={`lever-${key}`}
      type="number"
      inputMode="decimal"
      value={inputs[key]}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(key, e.target.value)}
    />
  );

  const slider = (key: LeverKey, min: number, max: number, step: number, label: string) => {
    const v = Number(inputs[key]);
    return (
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min}
        onChange={(e) => onChange(key, e.target.value)}
      />
    );
  };

  return (
    <aside className="panel levers" aria-labelledby="levers-h">
      <div className="panel-head">
        <h2 id="levers-h">What-if levers</h2>
        <button type="button" className="reset" onClick={onReset} disabled={!dirty}>
          Reset to seed
        </button>
      </div>
      <p className="fine">
        Each change reruns the shift in your browser. Defaults are seed values, every one an
        assumption unless marked sourced.
      </p>

      {notes.length > 0 && (
        <ul className="lever-notes" role="status" aria-live="polite">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <Row
        id="lever-parallelLines"
        label="Parallel lines"
        tag={<Assumption id="A7" />}
        hint="1 to 12. More lines: slower line takt, more capacity, same plant demand."
      >
        {number("parallelLines", 1, L.parallelLines.min, L.parallelLines.max)}
      </Row>

      <Row
        id="lever-annualDemandKits"
        label="Annual demand, kits"
        tag={<Sourced>sourced May 26, 2026, plus A4</Sourced>}
        hint="Changes takt and planned units only. Capacity does not move."
      >
        {number("annualDemandKits", 100000, L.annualDemandKits.min)}
      </Row>

      <Row
        id="lever-cycleTimeMultiplier"
        label="Cycle-time multiplier"
        tag={<Assumption id="A9" />}
        hint="0.25 to 3. Multiplies the 12.0 s engineered cycle at every station."
      >
        {slider(
          "cycleTimeMultiplier",
          L.cycleTimeMultiplier.min,
          L.cycleTimeMultiplier.max,
          0.05,
          "Cycle-time multiplier",
        )}
        {number(
          "cycleTimeMultiplier",
          0.05,
          L.cycleTimeMultiplier.min,
          L.cycleTimeMultiplier.max,
        )}
      </Row>

      <Row
        id="lever-firstPassYield"
        label="First-pass yield"
        tag={<Assumption id="A11" />}
        hint="0 to 1, every station. Lower yield: more scrap, lower quality and OEE."
      >
        {slider("firstPassYield", 0, 1, 0.01, "First-pass yield")}
        {number("firstPassYield", 0.01, 0, 1)}
      </Row>

      <Row
        id="lever-availability"
        label="Availability"
        tag={<Assumption id="A12" />}
        hint="0 to 1, every station. Lower availability: a larger downtime budget."
      >
        {slider("availability", 0, 1, 0.01, "Availability")}
        {number("availability", 0.01, 0, 1)}
      </Row>

      <Row
        id="lever-scheduledHours"
        label="Scheduled hours"
        tag={<Assumption id="A2" />}
        hint="1 to 16. Changes planned units, downtime budgets, and all shift totals."
      >
        {number("scheduledHours", 0.5, L.scheduledHours.min, L.scheduledHours.max)}
      </Row>

      <Row
        id="lever-bufferCapacity"
        label="Buffer size"
        tag={<Assumption id="A14" />}
        hint="0 to 20 units between stations. Buffers let stations keep working through a neighbor's outage."
      >
        {slider("bufferCapacity", L.bufferCapacity.min, L.bufferCapacity.max, 1, "Buffer size")}
        {number("bufferCapacity", 1, L.bufferCapacity.min, L.bufferCapacity.max)}
      </Row>

      <Row
        id="lever-seed"
        label="Seed"
        tag={<Assumption id="A16" />}
        hint="Replays downtime placement and yield draws. Analytical capacity does not change."
      >
        {number("seed", 1, 0)}
      </Row>

      <details className="overrides">
        <summary>Per-station overrides</summary>
        <p className="fine">
          Leave a cell blank to use the global lever. A filled cell wins for that station and can
          move the bottleneck (try 24 for the S5 cycle).
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Cycle, s</th>
              <th scope="col">Yield</th>
              <th scope="col">Avail.</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.id}>
                <th scope="row" title={s.name}>
                  {s.id}
                </th>
                {STATION_FIELDS.map((field) => (
                  <td key={field}>
                    <input
                      type="number"
                      inputMode="decimal"
                      aria-label={`${s.id} ${s.name} ${field} override`}
                      placeholder="global"
                      step={field === "cycle" ? 1 : 0.01}
                      value={stationInputs[s.id][field]}
                      onChange={(e) => onStationChange(s.id, field, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </aside>
  );
}
