/**
 * The grade controls, including the headline Triple-A toggle.
 *
 * Two honesty requirements drive the design:
 *
 * 1. **Triple-A is strict.** All three axes must be graded and all three must
 *    be `A`. Glama has no `A-`, so there is no looser "A band" variant to
 *    offer — it would select exactly the same set.
 * 2. **Roughly 12% of servers have no grade at all**, and an ungraded axis is
 *    unknown rather than bad. Whenever a grade filter is active the count of
 *    servers it cannot speak for is stated plainly, so an empty result is never
 *    read as "no such servers exist".
 */
import type { FilterState } from "../lib/filter-sort.ts";
import type { Grade, GradeAxis, GradeCoverage } from "../lib/grade.ts";

import { GRADE_AXES, GRADES } from "../lib/grade.ts";

const COVERAGE_LABELS: Readonly<Record<GradeCoverage, string>> = {
  "graded-all": "All three graded",
  "graded-partial": "Partly graded",
  "not-indexed": "Not on Glama",
};

export interface GradeFilterProps {
  readonly coverageCounts: ReadonlyMap<GradeCoverage, number>;
  readonly filter: FilterState;
  readonly onChange: (next: FilterState) => void;
  /** Servers in the current result set that Glama has never graded. */
  readonly ungraded: number;
  readonly tripleACount: number;
}

export function GradeFilter({
  coverageCounts,
  filter,
  onChange,
  tripleACount,
  ungraded,
}: GradeFilterProps): React.JSX.Element {
  const gradeFilterActive =
    filter.tripleA ||
    filter.gradeCoverage !== null ||
    Object.keys(filter.minGrades).length > 0;

  return (
    <fieldset className="facet">
      <legend>Glama grade</legend>

      <button
        aria-pressed={filter.tripleA}
        className={`aaa-toggle${filter.tripleA ? " on" : ""}`}
        onClick={(): void => {
          onChange({ ...filter, tripleA: !filter.tripleA });
        }}
        type="button"
      >
        <span className="aaa-mark">AAA</span>
        <span className="aaa-text">
          Triple-A only <span className="tri-count">{tripleACount}</span>
        </span>
      </button>
      <p className="facet-hint">
        Licence, quality and maintenance all graded <strong>A</strong>. Glama has no
        A−, so there is no looser variant.
      </p>

      <div className="grade-axes">
        {GRADE_AXES.map((axis) => (
          <label className="grade-axis" key={axis}>
            <span>{axis} ≥</span>
            <select
              onChange={(event): void => {
                const value = event.target.value;
                const next = { ...filter.minGrades };
                if (value === "") delete next[axis];
                else next[axis] = value as Grade;
                onChange({ ...filter, minGrades: next });
              }}
              value={filter.minGrades[axis] ?? ""}
            >
              <option value="">any</option>
              {GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="coverage-row">
        {(Object.keys(COVERAGE_LABELS) as GradeCoverage[]).map((coverage) => (
          <button
            aria-pressed={filter.gradeCoverage === coverage}
            className={`chip${filter.gradeCoverage === coverage ? " on" : ""}`}
            key={coverage}
            onClick={(): void => {
              onChange({
                ...filter,
                gradeCoverage: filter.gradeCoverage === coverage ? null : coverage,
              });
            }}
            type="button"
          >
            {COVERAGE_LABELS[coverage]}{" "}
            <span className="tri-count">{coverageCounts.get(coverage) ?? 0}</span>
          </button>
        ))}
      </div>

      {gradeFilterActive && ungraded > 0 && (
        <p className="warn" role="status">
          {ungraded} matching server{ungraded === 1 ? " has" : "s have"} no Glama grade
          at all and cannot satisfy a grade filter. An empty result here means “none
          that Glama has graded”, not “none exist”.
        </p>
      )}
    </fieldset>
  );
}

export function axisLabel(axis: GradeAxis): string {
  return axis;
}
