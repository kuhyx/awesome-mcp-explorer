/**
 * Named filter presets, persisted in localStorage.
 *
 * A preset stores the *encoded* query string rather than a FilterState object.
 * That way the stored form is the same thing the URL carries: presets survive
 * a change to FilterState's shape exactly as well as a shared link does — the
 * decoder already ignores params it no longer understands — and a preset can be
 * copied straight out of storage into a URL bar.
 */
import type { FilterState, SortDirection, SortKey } from "./filter-sort.ts";

import { decodeFilter, encodeFilter } from "./url-state.ts";

export interface Preset {
  readonly name: string;
  /** The encoded query string, e.g. `aaa=1&lang=rust`. */
  readonly search: string;
}

const STORAGE_KEY = "awesome-mcp-explorer:presets";

/** Curated starting points, so the feature is useful before you save anything. */
export const BUILTIN_PRESETS: readonly Preset[] = [
  { name: "Triple-A only", search: "aaa=1" },
  { name: "Triple-A + FOSS", search: "aaa=1&foss=yes" },
  { name: "Free or unknown cost", search: "cost=likely-free,unknown" },
  { name: "Official implementations", search: "official=1" },
  { name: "Local-only, no cloud", search: "scope=local,!cloud" },
  { name: "Actively maintained", search: "live=1&sort=pushed" },
  { name: "Rust servers", search: "lang=rust" },
];

/**
 * Reads saved presets.
 *
 * Returns `[]` for anything unreadable rather than throwing: localStorage can
 * be disabled, full, or hold JSON written by an older version, and none of
 * those should stop the app from rendering.
 */
export function loadPresets(storage: Storage): Preset[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPreset);
  } catch {
    return [];
  }
}

/** Saves presets, ignoring a storage failure (private mode, quota). */
export function savePresets(storage: Storage, presets: readonly Preset[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Losing a preset is a far better outcome than losing the page.
  }
}

function isPreset(value: unknown): value is Preset {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Preset).name === "string" &&
    typeof (value as Preset).search === "string"
  );
}

/** Adds a preset, replacing any existing one with the same name. */
export function addPreset(
  presets: readonly Preset[],
  name: string,
  filter: FilterState,
  sort: { dir: SortDirection; key: SortKey },
): Preset[] {
  const preset = { name, search: encodeFilter(filter, sort) };
  return [...presets.filter((p) => p.name !== name), preset];
}

export function removePreset(presets: readonly Preset[], name: string): Preset[] {
  return presets.filter((p) => p.name !== name);
}

/** Expands a preset back into state. */
export function applyPreset(preset: Preset): ReturnType<typeof decodeFilter> {
  return decodeFilter(preset.search);
}
