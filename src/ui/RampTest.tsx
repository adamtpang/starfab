import { useEffect, useState } from "react";
import { fmtInt } from "../lib/format";
import { SEED_PLANT } from "../plant";
import { RAMPS, runRamp, type RampResult, type RampVariable } from "../ramp";
import type { CrewId, Plant, WhatIfLevers } from "../types";
import { Detail } from "./Detail";

const ORDER: RampVariable[] = ["speed", "buffer", "availability", "lines"];

// Position of a lever value on the evenly spaced axis, by interpolating
// between the two ramp values around it. Null when it is off the axis.
function axisIndex(values: number[], value: number): number | null {
  for (let i = 1; i < values.length; i++) {
    const lo = Math.min(values[i - 1], values[i]);
    const hi = Math.max(values[i - 1], values[i]);
    if (value >= lo && value <= hi) {
      return i - 1 + (value - values[i - 1]) / (values[i] - values[i - 1]);
    }
  }
  return null;
}

function currentValue(variable: RampVariable, plant: Plant, levers: WhatIfLevers): number {
  if (variable === "speed") return levers.cycleTimeMultiplier ?? 1;
  if (variable === "buffer") return plant.bufferCapacity ?? 0;
  if (variable === "availability") return levers.availability ?? plant.stations[0].availability;
  return plant.parallelLines;
}

// Detail F. Ramp one lever across a range, with everything else held at the
// current settings, and mark where the line stops holding takt.
export function RampTest({
  plant,
  levers,
  crew,
}: {
  plant: Plant;
  levers: WhatIfLevers;
  crew: CrewId;
}) {
  const [variable, setVariable] = useState<RampVariable>("speed");
  const [result, setResult] = useState<RampResult | null>(null);
  const key = JSON.stringify(levers);

  // Each ramp is about ten full simulations, so wait for the levers to
  // settle before running it.
  useEffect(() => {
    const timer = setTimeout(() => setResult(runRamp(SEED_PLANT, levers, variable, crew)), 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, variable, crew]);

  const spec = RAMPS[variable];
  const ready = result !== null && result.variable === variable;

  const x0 = 64;
  const x1 = 700;
  const y0 = 196;
  const top = 26;
  const points = ready ? result.points : [];
  const max = Math.max(1, ...points.map((p) => Math.max(p.unitsGood, p.plannedUnitsAtTakt))) * 1.12;
  const xs = (i: number) => x0 + (points.length > 1 ? (i / (points.length - 1)) * (x1 - x0) : 0);
  const ys = (v: number) => y0 - (v / max) * (y0 - top);
  const breakIndex =
    ready && result.breakValue !== null ? axisIndex(spec.values, result.breakValue) : null;
  const nowIndex = axisIndex(spec.values, currentValue(variable, plant, levers));
  const station = (id: string) => plant.stations.find((s) => s.id === id);

  let verdict = "Running the ramp.";
  if (ready && result.verdict === "crosses" && result.breakValue !== null) {
    verdict = `The line starts holding takt at ${spec.label.toLowerCase()} ${spec.format(result.breakValue)}. Left of that mark it falls behind.`;
  } else if (ready && result.verdict === "holds") {
    verdict = `The line holds takt across this whole range of ${spec.label.toLowerCase()}.`;
  } else if (ready) {
    verdict = `No ${spec.label.toLowerCase()} in this range reaches takt. The best case, ${spec.format(result.closest.value)}, is still ${fmtInt(-result.closest.gap)} units short.`;
  }
  const limiter = ready ? station(result.closest.bottleneckStationId) : undefined;

  return (
    <Detail
      letter="F"
      title="Ramp test"
      note="one lever swept, everything else as set"
      span="full"
    >
      <div className="ramp">
        <div className="ramp-side">
          <div className="ramp-buttons" role="group" aria-label="Lever to ramp">
            {ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={id === variable ? "crew-btn active" : "crew-btn"}
                aria-pressed={id === variable}
                onClick={() => setVariable(id)}
              >
                {RAMPS[id].label}
              </button>
            ))}
          </div>
          <p className={ready && result.verdict !== "holds" ? "ramp-verdict ramp-warn" : "ramp-verdict"} role="status">
            {verdict}
          </p>
          {limiter && (
            <p className="fine">
              Bottleneck at that point: {limiter.id} {limiter.name}. Each point is a full
              simulated shift with the same seed, so the curve is repeatable. These are model
              outputs built on assumptions, not a forecast for any real line.
            </p>
          )}
        </div>
        <div className="ramp-chart" style={{ opacity: ready ? 1 : 0.4 }}>
          <svg
            viewBox="0 0 720 240"
            role="img"
            aria-label={`Good units against planned units as ${spec.label.toLowerCase()} changes. ${verdict}`}
          >
            <path className="g-axis" d={`M${x0},${top - 8} V${y0} H${x1}`} />
            {points.length > 0 && (
              <>
                <path
                  className="g-plan"
                  d={"M" + points.map((p, i) => `${xs(i)},${ys(p.plannedUnitsAtTakt)}`).join(" L")}
                />
                <text className="g-label g-flag" x={x1} y={ys(points[points.length - 1].plannedUnitsAtTakt) - 7} textAnchor="end">
                  PLANNED AT TAKT
                </text>
                <path
                  className="g-cum"
                  d={"M" + points.map((p, i) => `${xs(i)},${ys(p.unitsGood)}`).join(" L")}
                />
                {points.map((p, i) => (
                  <g key={p.value}>
                    <circle className={p.gap >= 0 ? "g-dot g-dot-ok" : "g-dot"} cx={xs(i)} cy={ys(p.unitsGood)} r={3.5} />
                    <text className="g-dim" x={xs(i)} y={y0 + 16} textAnchor="middle">
                      {spec.format(p.value)}
                    </text>
                  </g>
                ))}
                <text className="g-label" x={x0 + 8} y={ys(points[0].unitsGood) - 10}>
                  GOOD UNITS
                </text>
              </>
            )}
            {breakIndex !== null && (
              <g>
                <path className="g-break" d={`M${xs(breakIndex)},${top - 8} V${y0}`} />
                {/* Flip the label to the left of the mark near the right edge. */}
                <text
                  className="g-label g-flag"
                  x={xs(breakIndex) + (xs(breakIndex) > (x0 + x1) / 2 ? -6 : 6)}
                  y={top}
                  textAnchor={xs(breakIndex) > (x0 + x1) / 2 ? "end" : "start"}
                >
                  HOLDS TAKT FROM HERE
                </text>
              </g>
            )}
            {nowIndex !== null && points.length > 0 && (
              <g>
                <path className="g-now" d={`M${xs(nowIndex)},${y0} v-10`} />
                <text className="g-label" x={xs(nowIndex)} y={y0 - 14} textAnchor="middle">
                  NOW
                </text>
              </g>
            )}
            <text className="g-dim" x={x0} y={y0 + 34}>
              {spec.label.toUpperCase()}, {spec.unit.toUpperCase()}
            </text>
          </svg>
        </div>
      </div>
    </Detail>
  );
}
