/**
 * The whole filter sidebar: a fully controlled component whose only state is
 * what its parent hands it, matching dufs-cloud's FilterBar.
 */
import type { Facets } from "../lib/facets.ts";
import type { FilterState } from "../lib/filter-sort.ts";
import type { Cost, Tri } from "../lib/server.ts";

import { LANGUAGES, OPERATING_SYSTEMS, SCOPES } from "../../scripts/lib/parse-readme.ts";
import { formatStars } from "./server-row.tsx";
import { GradeFilter } from "./grade-filter.tsx";
import { RangeSlider } from "./range-slider.tsx";
import { TriStatePicker } from "./tri-state-picker.tsx";

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  cpp: "C/C++",
  csharp: "C#",
  go: "Go",
  java: "Java",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  typescript: "TS/JS",
};

const FOSS_OPTIONS: readonly { label: string; value: Tri }[] = [
  { label: "FOSS", value: "yes" },
  { label: "Not FOSS", value: "no" },
  { label: "Unclear", value: "unknown" },
];

const COST_OPTIONS: readonly { label: string; value: Cost }[] = [
  { label: "~free", value: "likely-free" },
  { label: "~paid", value: "likely-paid" },
  { label: "~unknown", value: "unknown" },
];

const RATE_OPTIONS: readonly { label: string; value: Tri }[] = [
  { label: "~limited", value: "yes" },
  { label: "~unlimited", value: "no" },
  { label: "~unknown", value: "unknown" },
];

export interface FilterBarProps {
  readonly categories: readonly string[];
  readonly facets: Facets;
  readonly filter: FilterState;
  readonly onChange: (next: FilterState) => void;
  readonly pushedValues: readonly number[];
  readonly starValues: readonly number[];
  readonly ungraded: number;
}

/** A one-of-N chip row that toggles back to null when the active chip is clicked. */
function ChipRow<T extends string>({
  counts,
  label,
  onSelect,
  options,
  value,
}: {
  readonly counts: ReadonlyMap<T, number>;
  readonly label: string;
  readonly onSelect: (next: null | T) => void;
  readonly options: readonly { label: string; value: T }[];
  readonly value: null | T;
}): React.JSX.Element {
  return (
    <fieldset className="facet">
      <legend>{label}</legend>
      <div className="coverage-row">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={`chip${value === option.value ? " on" : ""}`}
            key={option.value}
            onClick={(): void => {
              onSelect(value === option.value ? null : option.value);
            }}
            type="button"
          >
            {option.label}{" "}
            <span className="tri-count">{counts.get(option.value) ?? 0}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
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
        format={(language): string => LANGUAGE_NAMES[language] ?? language}
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

      <ChipRow
        counts={facets.foss}
        label="Licence"
        onSelect={(foss): void => {
          onChange({ ...filter, foss });
        }}
        options={FOSS_OPTIONS}
        value={filter.foss}
      />

      <ChipRow
        counts={facets.cost}
        label="Cost (inferred)"
        onSelect={(cost): void => {
          onChange({ ...filter, cost });
        }}
        options={COST_OPTIONS}
        value={filter.cost}
      />

      <ChipRow
        counts={facets.rateLimited}
        label="Rate limit (inferred)"
        onSelect={(rateLimited): void => {
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
        label="Stars"
        max={starMax}
        min={starMin}
        onChange={(lo, hi): void => {
          onChange({
            ...filter,
            maxStars: hi >= (starValues.at(-1) ?? 0) ? null : hi,
            minStars: lo <= (starValues[0] ?? 0) ? null : lo,
          });
        }}
        values={starValues}
      />

      <RangeSlider
        format={(t): string => new Date(t).toISOString().slice(0, 7)}
        label="Last push"
        max={pushedValues.at(-1) ?? 0}
        min={filter.pushedAfter ?? pushedValues[0] ?? 0}
        onChange={(lo): void => {
          onChange({
            ...filter,
            pushedAfter: lo <= (pushedValues[0] ?? 0) ? null : lo,
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
