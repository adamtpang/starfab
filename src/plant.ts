// Typed access to the seed plant. Numbers live in data/plant.seed.json so
// assumptions can be edited without touching engine code.

import seed from "../data/plant.seed.json";
import type { Plant } from "./types";

export const SEED_PLANT = seed as unknown as Plant;
