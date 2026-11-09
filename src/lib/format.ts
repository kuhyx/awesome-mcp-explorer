/**
 * Display formatting for one server row and the sliders.
 *
 * Pure so the same strings are produced at build time (prerendered rows) and
 * in the browser (age refresh, slider readouts).
 */
import type { Cost, Tri } from "./server.ts";

export const COST_LABELS: Readonly<Record<Cost, string>> = {
  "likely-free": "free",
  "likely-paid": "paid",
  unknown: "cost unknown",
};

export const RATE_LABELS: Readonly<Record<Tri, string>> = {
  no: "no rate limit",
  unknown: "limits unknown",
  yes: "rate limited",
};

/**
 * What a cost or rate-limit chip shows next to its coin or gauge icon. Kept
 * clear of the tri-state picker's own ☐ ✓ ✕, which mean off/include/exclude.
 */
export const COST_MARKS: Readonly<Record<Cost, string>> = {
  "likely-free": "0",
  "likely-paid": "$",
  unknown: "?",
};

export const RATE_MARKS: Readonly<Record<Tri, string>> = {
  no: "∞",
  unknown: "?",
  yes: "≤",
};

/**
 * "59.3k" — keeps the star column narrow and non-jittery.
 */
export function formatStars(stars: number): string {
  if (stars < 1000) return String(stars);
  return `${(stars / 1000).toFixed(stars < 10_000 ? 1 : 0)}k`;
}

/**
 * "3d", "2y": a number and its unit symbol, shown beside a clock icon.
 */
export function formatAge(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "?";
  const days = Math.floor((now - then) / 86_400_000);
  if (days < 1) return "0d";
  if (days < 30) return `${days}d`;
  return days < 365 ? `${Math.floor(days / 30)}mo` : `${Math.floor(days / 365)}y`;
}

/**
 * "2026-07" for a slider readout (epoch ms in).
 */
export function formatMonth(epochMs: number): string {
  const date = new Date(epochMs);
  return date.toISOString().slice(0, 7);
}

/**
 * "2026-07-01": the age text a row is prerendered with. It never goes stale,
 * and the browser swaps it for a relative age on load.
 */
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}
