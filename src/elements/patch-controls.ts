/**
 * Brings the prerendered controls in line with the current state by mutating
 * existing nodes; the `.astro` components stay the only place markup is written.
 */
import type { TriKey } from "../lib/facet-defs.ts";
import type { Facets } from "../lib/facets.ts";
import type { FilterState, SortState, TriSelect } from "../lib/filter-sort.ts";
import type { GradeCoverage } from "../lib/grade.ts";

import { isFilterActive } from "../lib/filter-sort.ts";
import { GRADE_AXES } from "../lib/grade.ts";
import { GLYPHS, stateOf, summarize } from "../lib/tri-state.ts";
import { required, requiredAs, setNumberAttribute } from "./dom.ts";

function setPressed(button: Element, isOn: boolean): void {
  button.setAttribute("aria-pressed", String(isOn));
  button.classList.toggle("on", isOn);
}

function patchTriGroup(
  group: HTMLElement,
  select: TriSelect<string>,
  counts: ReadonlyMap<string, number>,
): void {
  const names = new Map<string, string>();
  for (const button of group.querySelectorAll<HTMLButtonElement>("button.tri")) {
    const { name, option } = button.dataset as { name: string; option: string };
    const state = stateOf(select, option);
    const count = counts.get(option) ?? 0;
    names.set(option, name);
    button.setAttribute("class", `tri tri-${state}`);
    button.setAttribute("aria-label", `${name}: ${state}`);
    button.setAttribute("aria-pressed", String(state !== "off"));
    button.disabled = count === 0 && state === "off";
    required(button, ".tri-glyph").textContent = GLYPHS[state];
    required(button, ".tri-count").textContent = String(count);
  }
  const summary = required(group, ".facet-summary");
  const text = summarize(select, (option) => names.get(option) ?? option);
  summary.textContent = text;
  summary.title = text;
}

export function patchFacets(root: ParentNode, filter: FilterState, facets: Facets): void {
  for (const group of root.querySelectorAll<HTMLElement>("fieldset[data-facet]")) {
    const key = group.dataset.facet as TriKey;
    patchTriGroup(group, filter[key], facets[key]);
  }
  setPressed(required(root, '[data-action="toggle-official"]'), filter.official);
  setPressed(required(root, '[data-action="toggle-archived"]'), filter.hideArchived);
  required(root, '[data-count="official"]').textContent = String(facets.official);
}

export function patchGrade(
  root: ParentNode,
  filter: FilterState,
  facets: Facets,
  ungraded: number,
): void {
  setPressed(required(root, '[data-action="toggle-aaa"]'), filter.tripleA);
  required(root, '[data-count="aaa"]').textContent = String(facets.tripleA);
  for (const axis of GRADE_AXES) {
    requiredAs(root, `[data-axis="${axis}"]`, HTMLSelectElement).value =
      filter.minGrades[axis] ?? "";
  }
  for (const chip of root.querySelectorAll<HTMLElement>("[data-coverage]")) {
    const coverage = chip.dataset.coverage as GradeCoverage;
    setPressed(chip, filter.gradeCoverage === coverage);
    required(chip, ".tri-count").textContent = String(facets.gradeCoverage.get(coverage) ?? 0);
  }

  const isGradeFilterActive =
    filter.tripleA || filter.gradeCoverage !== null || Object.keys(filter.minGrades).length > 0;
  const warning = required(root, "[data-ungraded]");
  warning.hidden = !(isGradeFilterActive && ungraded > 0);
  required(warning, "[data-ungraded-text]").textContent =
    `${ungraded} matching server${ungraded === 1 ? " has" : "s have"}`;
}

export interface StatModel {
  readonly shown: number;
  readonly total: number;
}

export function patchStat(
  root: ParentNode,
  filter: FilterState,
  sort: SortState,
  stat: StatModel,
): void {
  required(root, "[data-shown]").textContent = stat.shown.toLocaleString("en-US");
  required(root, "[data-total]").textContent = stat.total.toLocaleString("en-US");
  requiredAs(root, "[data-sort-key]", HTMLSelectElement).value = sort.key;
  const direction = required(root, '[data-action="sort-dir"]');
  direction.textContent = sort.dir === "asc" ? "↑" : "↓";
  direction.setAttribute("aria-label", `Sort ${sort.dir === "asc" ? "ascending" : "descending"}`);
  required(root, '[data-action="reset"]').hidden = !isFilterActive(filter);
}

// A null bound removes the attribute, parking the thumb at the distribution's end.
export function patchSliders(root: ParentNode, filter: FilterState): void {
  const stars = required(root, '[data-slider="stars"] range-slider');
  setNumberAttribute(stars, "lo", filter.minStars);
  setNumberAttribute(stars, "hi", filter.maxStars);
  const pushed = required(root, '[data-slider="pushed"] range-slider');
  setNumberAttribute(pushed, "lo", filter.pushedAfter);
  setNumberAttribute(pushed, "hi", null);
}
