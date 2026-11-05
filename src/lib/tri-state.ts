/**
 * Tri-state selection logic: each option cycles off -> include -> exclude.
 *
 * Ported from `~/src/dufs-cloud/web/src/components/extension-picker.tsx`.
 */
import type { TriSelect } from "./filter-sort.ts";

export type TriValue = "exclude" | "include" | "off";

export const GLYPHS: Readonly<Record<TriValue, string>> = {
  exclude: "✕",
  include: "✓",
  off: "☐",
};

export function stateOf<T extends string>(select: TriSelect<T>, option: T): TriValue {
  if (select.includes.includes(option)) return "include";
  return select.excludes.includes(option) ? "exclude" : "off";
}

/**
 * The cycle order, as a table rather than nested ternaries.
 */
const NEXT_STATE: Readonly<Record<TriValue, TriValue>> = {
  exclude: "off",
  include: "exclude",
  off: "include",
};

/**
 * off -> include -> exclude -> off, rebuilding both lists from the new state.
 */
export function cycle<T extends string>(select: TriSelect<T>, option: T): TriSelect<T> {
  const next = NEXT_STATE[stateOf(select, option)];

  const includes = select.includes.filter((v) => v !== option);
  const excludes = select.excludes.filter((v) => v !== option);
  if (next === "include") return { excludes, includes: [...includes, option] };
  return { excludes: next === "exclude" ? [...excludes, option] : excludes, includes };
}

/**
 * "rust, go · not python", or "Any" when neutral.
 */
export function summarize<T extends string>(
  select: TriSelect<T>,
  format: (option: T) => string,
): string {
  const parts: string[] = [];
  if (select.includes.length > 0) {
    parts.push(select.includes.map((v) => format(v)).join(", "));
  }
  if (select.excludes.length > 0) {
    parts.push(`not ${select.excludes.map((v) => format(v)).join(", ")}`);
  }
  return parts.length === 0 ? "Any" : parts.join(" · ");
}
