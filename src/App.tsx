import { useMemo, useState } from "react";
import { applyLevers, sanitizeLevers } from "./applyLevers";
import { DEMAND_CITATIONS, DEMAND_DATE, DOCS_URL, REPO_URL } from "./citations";
import { simulateShift } from "./engine/simulate";
import { SEED_PLANT } from "./plant";
import type { CrewId, StationId, WhatIfLevers } from "./types";
import { Dashboard } from "./ui/Dashboard";
import { Disclaimer } from "./ui/Disclaimer";
import {
  Levers,
  type LeverInputs,
  type LeverKey,
  type StationField,
  type StationInputs,
} from "./ui/Levers";

const DESCRIPTION =
  "An unofficial production-line simulation of a kit factory, built as a learning project and proof of work.";

// Lever defaults come straight from the seed plant. Nothing is invented here.
function defaultInputs(): LeverInputs {
  const s0 = SEED_PLANT.stations[0];
  return {
    parallelLines: String(SEED_PLANT.parallelLines),
    annualDemandKits: String(SEED_PLANT.annualDemandKits),
    cycleTimeMultiplier: "1",
    firstPassYield: String(s0.firstPassYield),
    availability: String(s0.availability),
    scheduledHours: String(SEED_PLANT.shifts[0].scheduledHours),
    seed: String(SEED_PLANT.rngSeed),
  };
}

function defaultStationInputs(): StationInputs {
  const out = {} as StationInputs;
  for (const s of SEED_PLANT.stations) out[s.id] = { cycle: "", yield: "", availability: "" };
  return out;
}

// A blank field is "not a number" and falls back to the seed with a note.
function parse(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

function toLevers(inputs: LeverInputs, stationInputs: StationInputs): WhatIfLevers {
  const cycleTimeSeconds: Partial<Record<StationId, number>> = {};
  const firstPassYieldByStation: Partial<Record<StationId, number>> = {};
  const availabilityByStation: Partial<Record<StationId, number>> = {};
  for (const id of Object.keys(stationInputs) as StationId[]) {
    const row = stationInputs[id];
    if (row.cycle.trim() !== "") cycleTimeSeconds[id] = Number(row.cycle);
    if (row.yield.trim() !== "") firstPassYieldByStation[id] = Number(row.yield);
    if (row.availability.trim() !== "") availabilityByStation[id] = Number(row.availability);
  }
  return {
    parallelLines: parse(inputs.parallelLines),
    annualDemandKits: parse(inputs.annualDemandKits),
    cycleTimeMultiplier: parse(inputs.cycleTimeMultiplier),
    firstPassYield: parse(inputs.firstPassYield),
    availability: parse(inputs.availability),
    scheduledHours: parse(inputs.scheduledHours),
    seed: parse(inputs.seed),
    cycleTimeSeconds,
    firstPassYieldByStation,
    availabilityByStation,
  };
}

export default function App() {
  const [inputs, setInputs] = useState<LeverInputs>(defaultInputs);
  const [stationInputs, setStationInputs] = useState<StationInputs>(defaultStationInputs);
  const [crew, setCrew] = useState<CrewId>("A");

  const { plant, notes, sim } = useMemo(() => {
    const raw = toLevers(inputs, stationInputs);
    const { notes } = sanitizeLevers(raw);
    const plant = applyLevers(SEED_PLANT, raw);
    return { plant, notes, sim: simulateShift(plant, { crew }) };
  }, [inputs, stationInputs, crew]);

  const dirty =
    JSON.stringify(inputs) !== JSON.stringify(defaultInputs()) ||
    JSON.stringify(stationInputs) !== JSON.stringify(defaultStationInputs());

  return (
    <>
      <Disclaimer />
      <div className="page">
        <header className="masthead">
          <h1>starfab</h1>
          <p className="desc">{DESCRIPTION}</p>
        </header>

        <main className="layout">
          <Dashboard plant={plant} sim={sim} crew={crew} onCrew={setCrew} />
          <Levers
            inputs={inputs}
            onChange={(key: LeverKey, value: string) => setInputs((p) => ({ ...p, [key]: value }))}
            stations={SEED_PLANT.stations}
            stationInputs={stationInputs}
            onStationChange={(id: StationId, field: StationField, value: string) =>
              setStationInputs((p) => ({ ...p, [id]: { ...p[id], [field]: value } }))
            }
            notes={notes}
            onReset={() => {
              setInputs(defaultInputs());
              setStationInputs(defaultStationInputs());
            }}
            dirty={dirty}
          />
        </main>

        <footer className="footer">
          <Disclaimer compact />
          <p>
            Every number marked ASSUMPTION is a teaching default chosen so the demo can run. It is
            not a measurement from any real plant. Station names are generic on purpose. Real
            cycle times, yields, downtime, line counts, and layouts are unknown.
          </p>
          <p>
            Takt and planned units derive from one public figure: a stated target of 10 million
            kits per year by the end of 2026 ({DEMAND_DATE}). Sources:{" "}
            {DEMAND_CITATIONS.map((c, i) => (
              <span key={c.url}>
                {i > 0 && ", "}
                <a href={c.url}>{c.title}</a>
              </span>
            ))}
            .
          </p>
          <p className="footer-links">
            <a href={DOCS_URL}>Specs and assumptions (docs)</a>
            <a href={`${DOCS_URL}/data-sources.md`}>Data sources</a>
            <a href={REPO_URL}>Source code</a>
          </p>
        </footer>
      </div>
    </>
  );
}
