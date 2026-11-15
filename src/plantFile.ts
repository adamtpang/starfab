// Load a plant from a file the visitor picks. The file never leaves the
// browser. Every value is checked, every problem is reported in plain
// words, and every default that had to be filled in is listed, so nothing
// is assumed silently.

import type { CrewId, Plant, ShiftPattern, Source, Station, StationId } from "./types";

const STATION_IDS: StationId[] = ["S1", "S2", "S3", "S4", "S5", "S6"];
const CREWS: CrewId[] = ["A", "B", "C", "D"];
// Keeps one simulated shift fast enough to rerun on every lever change.
const MAX_MACHINE_SECONDS = 14_000_000;

export interface PlantFileResult {
  plant: Plant | null;
  errors: string[];
  defaults: string[]; // values the file left out, and what was used instead
}

const FROM_FILE: Source = { kind: "assumption", id: "FILE", note: "Loaded from your file." };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePlantFile(text: string, fallback: Plant): PlantFileResult {
  const errors: string[] = [];
  const defaults: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { plant: null, errors: ["The file is not valid JSON."], defaults };
  }
  if (!isRecord(raw)) {
    return { plant: null, errors: ["The file must contain one JSON object."], defaults };
  }
  const file = raw;

  // Read a number, or report why it cannot be used.
  const num = (
    source: Record<string, unknown>,
    key: string,
    label: string,
    min: number,
    max: number,
    options: { integer?: boolean; fallback?: number } = {},
  ): number => {
    const value = source[key];
    if (value === undefined || value === null) {
      if (options.fallback !== undefined) {
        defaults.push(`${label} was missing, so ${options.fallback} is used.`);
        return options.fallback;
      }
      errors.push(`${label} is missing.`);
      return min;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${label} must be a number.`);
      return min;
    }
    if (options.integer && !Number.isInteger(value)) {
      errors.push(`${label} must be a whole number.`);
      return min;
    }
    if (value < min || value > max) {
      errors.push(`${label} must be between ${min} and ${max}. The file has ${value}.`);
      return min;
    }
    return value;
  };

  const rawStations = file.stations;
  const stations: Station[] = [];
  if (!Array.isArray(rawStations) || rawStations.length < 1 || rawStations.length > STATION_IDS.length) {
    errors.push(`"stations" must be a list of 1 to ${STATION_IDS.length} stations.`);
  } else {
    rawStations.forEach((entry, i) => {
      const id = STATION_IDS[i];
      if (!isRecord(entry)) {
        errors.push(`Station ${i + 1} must be an object.`);
        return;
      }
      if (entry.id !== undefined && entry.id !== id) {
        errors.push(`Station ${i + 1} must have the id "${id}". Ids run S1, S2, S3 in order.`);
      }
      const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 40) : "";
      if (!name) errors.push(`${id} needs a name.`);
      let feeds: StationId | undefined;
      if (entry.feeds !== undefined && entry.feeds !== null) {
        const target = STATION_IDS.indexOf(entry.feeds as StationId);
        if (target <= i || target >= rawStations.length) {
          errors.push(`${id} "feeds" must name a later station in the list.`);
        } else {
          feeds = STATION_IDS[target];
        }
      }
      const station: Station = {
        id,
        name,
        cycleTimeSeconds: num(entry, "cycleTimeSeconds", `${id} cycleTimeSeconds`, 1, 3600),
        parallelUnits: num(entry, "parallelUnits", `${id} parallelUnits`, 1, 40, { integer: true, fallback: 1 }),
        operators: num(entry, "operators", `${id} operators`, 0, 40, { integer: true, fallback: 1 }),
        firstPassYield: num(entry, "firstPassYield", `${id} firstPassYield`, 0, 1),
        availability: num(entry, "availability", `${id} availability`, 0, 1),
        performance: num(entry, "performance", `${id} performance`, 0.05, 1, { fallback: 1 }),
        sources: {
          name: FROM_FILE,
          cycleTimeSeconds: FROM_FILE,
          parallelUnits: FROM_FILE,
          operators: FROM_FILE,
          firstPassYield: FROM_FILE,
          availability: FROM_FILE,
          performance: FROM_FILE,
        },
      };
      if (feeds) station.feeds = feeds;
      stations.push(station);
    });
  }

  const scheduledHours = num(file, "scheduledHours", "scheduledHours", 1, 16, { fallback: 12 });
  const shifts: ShiftPattern[] = CREWS.map((crew, k) => ({
    ...(fallback.shifts[k] ?? fallback.shifts[0]),
    crew,
    scheduledHours,
  }));
  defaults.push("Crew clock times are not read from the file. The star hall's shift pattern is used.");

  const parallelLines = num(file, "parallelLines", "parallelLines", 1, 12, { integer: true });
  const plant: Plant = {
    name: typeof file.name === "string" && file.name.trim() ? file.name.trim().slice(0, 60) : "your plant",
    unofficialDisclaimer: fallback.unofficialDisclaimer,
    annualDemandKits: num(file, "annualDemandKits", "annualDemandKits", 1, 1_000_000_000),
    calendarDays: num(file, "calendarDays", "calendarDays", 1, 366, { fallback: 365 }),
    hoursPerDay: num(file, "hoursPerDay", "hoursPerDay", 1, 24, { fallback: 24 }),
    parallelLines,
    rngSeed: num(file, "rngSeed", "rngSeed", 0, 4294967295, { integer: true, fallback: 1 }),
    meanDowntimeEventSeconds: num(file, "meanDowntimeEventSeconds", "meanDowntimeEventSeconds", 1, 86400, {
      fallback: 900,
    }),
    bufferCapacity: num(file, "bufferCapacity", "bufferCapacity", 0, 20, { integer: true, fallback: 0 }),
    hall: {
      id: "custom",
      label: "Your plant",
      product: "units",
      unitNoun: "unit",
      unitNounPlural: "units",
      blurb: "Loaded from your file. Every number below came from that file or is listed as a default.",
    },
    demandInfo: {
      statement: "the figure in your file",
      date: "loaded in this browser, not uploaded anywhere",
      links: [],
      assumptionIds: ["FILE"],
    },
    sources: {
      annualDemandKits: FROM_FILE,
      parallelLines: FROM_FILE,
      bufferCapacity: FROM_FILE,
      meanDowntimeEventSeconds: FROM_FILE,
      rngSeed: FROM_FILE,
    },
    stations,
    shifts,
  };

  if (errors.length === 0) {
    const machines = stations.reduce((n, s) => n + s.parallelUnits, 0);
    const load = machines * parallelLines * scheduledHours * 3600;
    if (load > MAX_MACHINE_SECONDS) {
      errors.push(
        `This plant is too large to rerun live: ${machines} machines on ${parallelLines} lines for ${scheduledHours} hours. Reduce lines, machines or hours.`,
      );
    }
  }
  return { plant: errors.length === 0 ? plant : null, errors, defaults };
}

// The same shape the loader reads, for a hall that is already running, so a
// visitor can save it, edit the numbers, and load it back.
export function plantToFile(plant: Plant): string {
  return JSON.stringify(
    {
      name: plant.name,
      annualDemandKits: plant.annualDemandKits,
      calendarDays: plant.calendarDays,
      hoursPerDay: plant.hoursPerDay,
      parallelLines: plant.parallelLines,
      rngSeed: plant.rngSeed,
      meanDowntimeEventSeconds: plant.meanDowntimeEventSeconds,
      bufferCapacity: plant.bufferCapacity ?? 0,
      scheduledHours: plant.shifts[0]?.scheduledHours ?? 12,
      stations: plant.stations.map((s) => ({
        id: s.id,
        name: s.name,
        cycleTimeSeconds: s.cycleTimeSeconds,
        parallelUnits: s.parallelUnits,
        operators: s.operators,
        firstPassYield: s.firstPassYield,
        availability: s.availability,
        performance: s.performance,
        ...(s.feeds ? { feeds: s.feeds } : {}),
      })),
    },
    null,
    2,
  );
}
