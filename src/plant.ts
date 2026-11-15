// Typed access to the seed plants. Numbers live in data/*.seed.json so
// assumptions can be edited without touching engine code.

import fabSeed from "../data/fab.seed.json";
import starSeed from "../data/plant.seed.json";
import type { Plant, Source } from "./types";

export const SEED_PLANT = starSeed as unknown as Plant;
export const FAB_PLANT = fabSeed as unknown as Plant;

export type HallId = "star" | "fab";
export const HALLS: Record<HallId, Plant> = { star: SEED_PLANT, fab: FAB_PLANT };

// The assumption id recorded for a seed value, for the on-screen tags.
export function assumptionId(source: Source | undefined, fallback: string): string {
  return source && source.kind === "assumption" ? source.id : fallback;
}

export function plantSourceId(plant: Plant, key: string, fallback: string): string {
  return assumptionId(plant.sources?.[key], fallback);
}

export function stationSourceId(plant: Plant, key: string, fallback: string): string {
  return assumptionId(plant.stations[0]?.sources[key], fallback);
}
