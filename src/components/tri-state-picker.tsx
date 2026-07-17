/**
 * A tri-state facet picker: each option cycles off -> include -> exclude.
 *
 * Ported from `~/dufs-cloud/web/src/components/extension-picker.tsx`. The
 * rationale carries over exactly: showing every option at once (rather than a
 * datalist, which hides the rest once you pick one) and folding "not X" into
 * the same control removes the need for a separate negation toggle.
 *
 * The `aria-label` doubles as the test hook, which is what keeps these
 * components accessible by default rather than by audit.
 */
import type { TriSelect } from "../lib/filter-sort.ts";

export type TriValue = "exclude" | "include" | "off";

const GLYPHS: Readonly<Record<TriValue, string>> = {
  exclude: "✕",
  include: "✓",
  off: "☐",
};

export interface TriStatePickerProps<T extends string> {
  /** Count of matching servers per option, from the currently filtered set. */
  readonly counts: ReadonlyMap<T, number>;
  /** Renders an option's display name; defaults to the raw value. */
  readonly format?: (option: T) => string;
  readonly label: string;
  readonly onChange: (next: TriSelect<T>) => void;
  readonly options: readonly T[];
  readonly value: TriSelect<T>;
}

export function stateOf<T extends string>(select: TriSelect<T>, option: T): TriValue {
  if (select.includes.includes(option)) return "include";
  if (select.excludes.includes(option)) return "exclude";
  return "off";
}

/** off -> include -> exclude -> off, rebuilding both lists from the new state. */
/** The cycle order, as a table rather than nested ternaries. */
const NEXT_STATE: Readonly<Record<TriValue, TriValue>> = {
  exclude: "off",
  include: "exclude",
  off: "include",
};

export function cycle<T extends string>(select: TriSelect<T>, option: T): TriSelect<T> {
  const next = NEXT_STATE[stateOf(select, option)];

  const includes = select.includes.filter((v) => v !== option);
  const excludes = select.excludes.filter((v) => v !== option);
  if (next === "include") return { excludes, includes: [...includes, option] };
  if (next === "exclude") return { excludes: [...excludes, option], includes };
  return { excludes, includes };
}

/** "rust, go · not python", or "Any" when neutral. */
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

export function TriStatePicker<T extends string>({
  counts,
  format = (option): string => option,
  label,
  onChange,
  options,
  value,
}: TriStatePickerProps<T>): React.JSX.Element {
  return (
    <fieldset className="facet">
      <legend>
        {label} <span className="facet-summary">{summarize(value, format)}</span>
      </legend>
      <div className="facet-options">
        {options.map((option) => {
          const state = stateOf(value, option);
          const count = counts.get(option) ?? 0;
          return (
            <button
              aria-label={`${format(option)}: ${state}`}
              aria-pressed={state !== "off"}
              className={`tri tri-${state}`}
              disabled={count === 0 && state === "off"}
              key={option}
              onClick={(): void => {
                onChange(cycle(value, option));
              }}
              type="button"
            >
              <span aria-hidden="true" className="tri-glyph">
                {GLYPHS[state]}
              </span>
              <span className="tri-name">{format(option)}</span>
              <span className="tri-count">{count}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
