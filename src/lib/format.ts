// Display helpers. Every formatter returns a plain string and never NaN.

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function fmtInt(n: number): string {
  return int.format(Math.round(safe(n)));
}

export function fmtNum(n: number, digits = 1): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe(n));
}

export function fmtPct(n: number, digits = 1): string {
  return `${fmtNum(safe(n) * 100, digits)}%`;
}

export function fmtSigned(n: number): string {
  const v = Math.round(safe(n));
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}${int.format(Math.abs(v))}`;
}

export function fmtMinutes(seconds: number): string {
  return fmtNum(safe(seconds) / 60, 0);
}

export function fmtHours(seconds: number, digits = 2): string {
  return fmtNum(safe(seconds) / 3600, digits);
}

// "05:00" to "5:00 AM"
export function fmtClock(clock: string): string {
  const [h, m] = clock.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const REASON_LABELS: Record<string, string> = {
  breakdown: "Breakdown",
  changeover: "Changeover",
  material_wait: "Material wait",
  quality_hold: "Quality hold",
};
