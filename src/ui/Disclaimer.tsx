import { SEED_PLANT } from "../plant";

// The unofficial disclaimer. Shown at the very top of the page and again in
// the footer. The text comes from the seed so it cannot drift.
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "disclaimer disclaimer-compact" : "disclaimer"} role="note">
      {SEED_PLANT.unofficialDisclaimer}
    </p>
  );
}
