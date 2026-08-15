import { nth, RangeSlider } from "@kuhyx/web-ui";

/**
 * The whole filter sidebar: a fully controlled component whose only state is
 * what its parent hands it, matching dufs-cloud's FilterBar.
 */
import type { Facets } from "../lib/facets.ts";
import type { FilterState } from "../lib/filter-sort.ts";
import type { Cost, Language, Tri } from "../lib/server.ts";

import { LANGUAGES, OPERATING_SYSTEMS, SCOPES } from "../../scripts/lib/parse-readme.ts";
import { GradeFilter } from "./grade-filter.tsx";
import { formatStars } from "./server-row.tsx";
import { TriStatePicker } from "./tri-state-picker.tsx";

/** Keyed by Language, so a new language is a compile error, not a fallback. */
const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  cpp: "C/C++",
  csharp: "C#",
  go: "Go",
  java: "Java",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  typescript: "TS/JS",
};

// Licence, cost and rate limit are tri-state pickers rather than pick-one
// chips: "FOSS or unclear" and "free or unknown" are ordinary things to want,
// and roughly half of each of the inferred fields is `unknown`, so forcing a
// single choice made those filters nearly unusable.
const FOSS_OPTIONS: readonly Tri[] = ["yes", "no", "unknown"];
const FOSS_NAMES: Readonly<Record<Tri, string>> = {
  no: "Not FOSS",
  unknown: "Unclear",
  yes: "FOSS",
};

const COST_OPTIONS: readonly Cost[] = ["likely-free", "likely-paid", "unknown"];
const COST_NAMES: Readonly<Record<Cost, string>> = {
  "likely-free": "~free",
  "likely-paid": "~paid",
  unknown: "~unknown",
};

const RATE_OPTIONS: readonly Tri[] = ["yes", "no", "unknown"];
const RATE_NAMES: Readonly<Record<Tri, string>> = {
  no: "~unlimited",
  unknown: "~unknown",
  yes: "~limited",
};

export interface FilterBarProps {
  readonly categories: readonly string[];
  readonly facets: Facets;
  readonly filter: FilterState;
  readonly onChange: (next: FilterState) => void;
  readonly pushedValues: readonly number[];
  readonly starValues: readonly number[];
  readonly ungraded: number;
}

export function FilterBar({
  categories,
  facets,
  filter,
  onChange,
  pushedValues,
  starValues,
  ungraded,
}: FilterBarProps): React.JSX.Element {
  const starMin = filter.minStars ?? starValues[0] ?? 0;
  const starMax = filter.maxStars ?? starValues.at(-1) ?? 0;

  return (
    <aside className="filters">
      <GradeFilter
        coverageCounts={facets.gradeCoverage}
        filter={filter}
        onChange={onChange}
        tripleACount={facets.tripleA}
        ungraded={ungraded}
      />

      <fieldset className="facet">
        <legend>Provenance</legend>
        <button
          aria-pressed={filter.official}
          className={`chip${filter.official ? " on" : ""}`}
          onClick={(): void => {
            onChange({ ...filter, official: !filter.official });
          }}
          type="button"
        >
          🎖️ Official only <span className="tri-count">{facets.official}</span>
        </button>
        <button
          aria-pressed={filter.hideArchived}
          className={`chip${filter.hideArchived ? " on" : ""}`}
          onClick={(): void => {
            onChange({ ...filter, hideArchived: !filter.hideArchived });
          }}
          type="button"
        >
          Hide archived
        </button>
      </fieldset>

      <TriStatePicker
        counts={facets.languages}
        format={(language): string => LANGUAGE_NAMES[language]}
        label="Language"
        onChange={(languages): void => {
          onChange({ ...filter, languages });
        }}
        options={LANGUAGES}
        value={filter.languages}
      />

      <TriStatePicker
        counts={facets.scope}
        label="Scope (local vs cloud)"
        onChange={(scope): void => {
          onChange({ ...filter, scope });
        }}
        options={SCOPES}
        value={filter.scope}
      />

      <TriStatePicker
        counts={facets.os}
        label="Operating system"
        onChange={(os): void => {
          onChange({ ...filter, os });
        }}
        options={OPERATING_SYSTEMS}
        value={filter.os}
      />

      <TriStatePicker
        counts={facets.foss}
        format={(value): string => FOSS_NAMES[value]}
        label="Licence"
        onChange={(foss): void => {
          onChange({ ...filter, foss });
        }}
        options={FOSS_OPTIONS}
        value={filter.foss}
      />

      <TriStatePicker
        counts={facets.cost}
        format={(value): string => COST_NAMES[value]}
        label="Cost (inferred)"
        onChange={(cost): void => {
          onChange({ ...filter, cost });
        }}
        options={COST_OPTIONS}
        value={filter.cost}
      />

      <TriStatePicker
        counts={facets.rateLimited}
        format={(value): string => RATE_NAMES[value]}
        label="Rate limit (inferred)"
        onChange={(rateLimited): void => {
          onChange({ ...filter, rateLimited });
        }}
        options={RATE_OPTIONS}
        value={filter.rateLimited}
      />

      <p className="facet-hint">
        Cost and rate limits are <strong>inferred</strong> from each server’s scope and
        description — neither the awesome list nor Glama publishes them. Values are
        marked <code>~</code> and can be corrected in <code>data/overrides.json</code>.
      </p>

      <RangeSlider
        format={formatStars}
        hi={starMax}
        label="Stars"
        lo={starMin}
        onChange={(lo, hi): void => {
          // A bound at the distribution's edge means "no constraint". nth
          // rather than `?? 0`: the slider only calls back when it has two or
          // more values, so a default here would be an unreachable branch.
          onChange({
            ...filter,
            maxStars: hi >= nth(starValues, starValues.length - 1) ? null : hi,
            minStars: lo <= nth(starValues, 0) ? null : lo,
          });
        }}
        values={starValues}
      />

      <RangeSlider
        format={(t): string => {
          const date = new Date(t);
          return date.toISOString().slice(0, 7);
        }}
        hi={pushedValues.at(-1) ?? 0}
        label="Last push"
        lo={filter.pushedAfter ?? pushedValues[0] ?? 0}
        onChange={(lo): void => {
          onChange({
            ...filter,
            pushedAfter: lo <= nth(pushedValues, 0) ? null : lo,
          });
        }}
        values={pushedValues}
      />

      <TriStatePicker
        counts={facets.categories}
        label="Category"
        onChange={(next): void => {
          onChange({ ...filter, categories: next });
        }}
        options={categories}
        value={filter.categories}
      />
    </aside>
  );
}
