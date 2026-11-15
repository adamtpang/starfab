import { useEffect, useMemo, useState } from "react";
import { applyLevers, sanitizeLevers } from "./applyLevers";
import { DOCS_URL, REPO_URL } from "./citations";
import { simulateShift } from "./engine/simulate";
import { HALLS, type HallId } from "./plant";
import { parsePlantFile, plantToFile, type PlantFileResult } from "./plantFile";
import type { CrewId, Plant, StationId, WhatIfLevers } from "./types";
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
function defaultInputs(SEED_PLANT: Plant): LeverInputs {
  const s0 = SEED_PLANT.stations[0];
  return {
    parallelLines: String(SEED_PLANT.parallelLines),
    annualDemandKits: String(SEED_PLANT.annualDemandKits),
    cycleTimeMultiplier: "1",
    firstPassYield: String(s0.firstPassYield),
    availability: String(s0.availability),
    scheduledHours: String(SEED_PLANT.shifts[0].scheduledHours),
    bufferCapacity: String(SEED_PLANT.bufferCapacity ?? 0),
    seed: String(SEED_PLANT.rngSeed),
  };
}

function defaultStationInputs(SEED_PLANT: Plant): StationInputs {
  const out = {} as StationInputs;
  for (const s of SEED_PLANT.stations) out[s.id] = { cycle: "", yield: "", availability: "" };
  return out;
}

export type Theme = "vacuum" | "studio";

// The page opens in the dark Vacuum look. "#studio" in the address, or the
// toggle, switches to the light Studio theme.
function initialTheme(): Theme {
  try {
    if (location.hash === "#studio") return "studio";
    if (location.hash === "#vacuum") return "vacuum";
    return localStorage.getItem("starfab-theme") === "studio" ? "studio" : "vacuum";
  } catch {
    return "vacuum";
  }
}

// A blank field is "not a number" and falls back to the seed with a note.
function parse(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

function toLevers(inputs: LeverInputs, stationInputs: StationInputs, seed: Plant): WhatIfLevers {
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
    // The yield and availability levers set every station at once. Left at
    // their starting value they do nothing, so a plant whose stations differ
    // keeps its own per-station values until a lever is actually moved.
    firstPassYield:
      inputs.firstPassYield === String(seed.stations[0].firstPassYield)
        ? undefined
        : parse(inputs.firstPassYield),
    availability:
      inputs.availability === String(seed.stations[0].availability)
        ? undefined
        : parse(inputs.availability),
    scheduledHours: parse(inputs.scheduledHours),
    bufferCapacity: parse(inputs.bufferCapacity),
    seed: parse(inputs.seed),
    cycleTimeSeconds,
    firstPassYieldByStation,
    availabilityByStation,
  };
}

export default function App() {
  const [hall, setHall] = useState<HallId>("star");
  const [custom, setCustom] = useState<Plant | null>(null);
  const [fileReport, setFileReport] = useState<PlantFileResult | null>(null);
  const halls: Partial<Record<HallId, Plant>> = custom ? { ...HALLS, custom } : HALLS;
  const seed = halls[hall] ?? HALLS.star;
  const [inputs, setInputs] = useState<LeverInputs>(() => defaultInputs(HALLS.star));
  const [stationInputs, setStationInputs] = useState<StationInputs>(() =>
    defaultStationInputs(HALLS.star),
  );
  // Each hall has its own seed, so switching halls starts from that seed.
  const openHall = (next: HallId, plant: Plant) => {
    setHall(next);
    setInputs(defaultInputs(plant));
    setStationInputs(defaultStationInputs(plant));
  };
  const chooseHall = (next: HallId) => openHall(next, halls[next] ?? HALLS.star);

  // Read a plant file in the browser. Nothing is uploaded.
  const loadFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then((text) => {
      const report = parsePlantFile(text, HALLS.star);
      setFileReport(report);
      if (report.plant) {
        setCustom(report.plant);
        openHall("custom", report.plant);
      }
    });
  };
  const saveFile = () => {
    const url = URL.createObjectURL(new Blob([plantToFile(seed)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `starfab-${seed.hall?.id ?? "plant"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const [crew, setCrew] = useState<CrewId>("A");
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("starfab-theme", theme);
    } catch {
      // Storage can be blocked. The toggle still works for this visit.
    }
  }, [theme]);

  // Follow "#studio" and "#vacuum" when the address changes without a reload.
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#studio") setTheme("studio");
      if (location.hash === "#vacuum") setTheme("vacuum");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const { plant, notes, sim, levers } = useMemo(() => {
    const raw = toLevers(inputs, stationInputs, seed);
    const { notes, levers } = sanitizeLevers(raw);
    const plant = applyLevers(seed, raw);
    return { plant, notes, levers, sim: simulateShift(plant, { crew }) };
  }, [inputs, stationInputs, crew, seed]);

  const dirty =
    JSON.stringify(inputs) !== JSON.stringify(defaultInputs(seed)) ||
    JSON.stringify(stationInputs) !== JSON.stringify(defaultStationInputs(seed));

  return (
    <>
      <Disclaimer />
      <div className="page">
        <header className="masthead">
          <h1>starfab</h1>
          <p className="desc">{DESCRIPTION}</p>
          <div className="hall-switch" role="group" aria-label="Hall">
            {(Object.keys(halls) as HallId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={id === hall ? "crew-btn active" : "crew-btn"}
                aria-pressed={id === hall}
                onClick={() => chooseHall(id)}
              >
                {halls[id]?.hall?.label ?? id}
              </button>
            ))}
            <label className="crew-btn file-btn">
              Load a plant file
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  loadFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button type="button" className="crew-btn" onClick={saveFile}>
              Save this hall as a file
            </button>
          </div>
          {/* One button. Its label names the mode you would switch to. */}
          <button
            type="button"
            className="crew-btn theme-toggle"
            onClick={() => setTheme(theme === "studio" ? "vacuum" : "studio")}
          >
            {theme === "studio" ? "Dark mode" : "Light mode"}
          </button>
        </header>

        {fileReport && (
          <div className={fileReport.plant ? "file-report" : "file-report file-report-bad"} role="status">
            <strong>
              {fileReport.plant
                ? "Your plant is loaded. It was read in this browser and not uploaded anywhere."
                : "That file could not be loaded. Nothing changed."}
            </strong>
            {fileReport.errors.length > 0 && (
              <ul>
                {fileReport.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {fileReport.plant && fileReport.defaults.length > 0 && (
              <details>
                <summary>
                  {fileReport.defaults.length} values were not in the file. See what was used.
                </summary>
                <ul>
                  {fileReport.defaults.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
            <button type="button" className="crew-btn" onClick={() => setFileReport(null)}>
              Dismiss
            </button>
          </div>
        )}

        <main className="layout">
          <Dashboard
            plant={plant}
            sim={sim}
            seed={seed}
            levers={levers}
            crew={crew}
            onCrew={setCrew}
            theme={theme}
          />
          <Levers
            inputs={inputs}
            onChange={(key: LeverKey, value: string) => setInputs((p) => ({ ...p, [key]: value }))}
            seed={seed}
            stationInputs={stationInputs}
            onStationChange={(id: StationId, field: StationField, value: string) =>
              setStationInputs((p) => ({ ...p, [id]: { ...p[id], [field]: value } }))
            }
            notes={notes}
            onReset={() => {
              setInputs(defaultInputs(seed));
              setStationInputs(defaultStationInputs(seed));
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
            Both halls are fictional. Public figures are used only to give each hall a believable
            scale. In the {seed.hall?.label.toLowerCase() ?? "hall"}, takt and planned units are{" "}
            {seed.demandInfo?.statement} ({seed.demandInfo?.date}).
            {seed.demandInfo && seed.demandInfo.links.length > 0 && (
              <>
                {" "}
                Sources:{" "}
                {seed.demandInfo.links.map((c, i) => (
                  <span key={c.url}>
                    {i > 0 && ", "}
                    <a href={c.url}>{c.title}</a>
                  </span>
                ))}
                .
              </>
            )}
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
