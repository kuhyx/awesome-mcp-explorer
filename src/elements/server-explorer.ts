/**
 * `<server-explorer>`: owns the filter/sort state and keeps the prerendered
 * page in step with it.
 *
 * State lives in the URL (filters/sort) or localStorage (presets). The rows,
 * controls and counts are already in the HTML; this element only patches them,
 * so there is no render function that builds markup and no framework.
 */
import { nth } from "@kuhyx/web-ui";
import { RangeSliderElement } from "@kuhyx/web-ui/range-slider";

import type { ExportFormat } from "../lib/export.ts";
import type { TriKey } from "../lib/facet-defs.ts";
import type { FilterState, SortDirection, SortKey, SortState, TriSelect } from "../lib/filter-sort.ts";
import type { GradeCoverage } from "../lib/grade.ts";
import type { Preset } from "../lib/presets.ts";
import type { Server } from "../lib/server.ts";

import { exportServers, FILE_EXTENSIONS, MIME_TYPES } from "../lib/export.ts";
import { computeFacets, pushedValues, starValues, ungradedCount } from "../lib/facets.ts";
import { applyFilterSort, DEFAULT_FILTER, DEFAULT_SORT } from "../lib/filter-sort.ts";
import { formatMonth, formatStars } from "../lib/format.ts";
import { GRADE_AXES } from "../lib/grade.ts";
import { addPreset, loadPresets, removePreset, savePresets } from "../lib/presets.ts";
import { cycle } from "../lib/tri-state.ts";
import { decodeFilter } from "../lib/url-state.ts";
import { flashCopied } from "./copy-feedback.ts";
import { required, requiredAs } from "./dom.ts";
import { bindKeyboard } from "./keyboard.ts";
import { ListView } from "./list-view.ts";
import { loadServers } from "./load-servers.ts";
import { patchFacets, patchGrade, patchSliders, patchStat } from "./patch-controls.ts";
import { readUrl, writeUrl } from "./url-sync.ts";

interface RangeDetail {
  readonly hi: number;
  readonly lo: number;
}

export class ServerExplorer extends HTMLElement {
  #filter: FilterState = DEFAULT_FILTER;
  #isReady = false;
  readonly #list = new ListView(this);
  #presets: Preset[] = [];
  #pushed: readonly number[] = [];
  #servers: readonly Server[] = [];
  #sort: SortState = DEFAULT_SORT;
  #stars: readonly number[] = [];
  #stopKeyboard: (() => void) | undefined;

  readonly #onPopState = (): void => {
    this.#readUrl();
    if (this.#isReady) this.#render();
  };

  public constructor() {
    super();
    this.addEventListener("click", (event) => {
      this.#onClick(event);
    });
    this.addEventListener("change", (event) => {
      this.#onChange(event);
    });
    this.addEventListener("input", (event) => {
      this.#onInput(event);
    });
    this.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#savePreset();
    });
  }

  async #load(): Promise<void> {
    const state = await loadServers();
    if (!this.isConnected) return;
    if (state.kind === "error") {
      // Spoken and logged only: on screen the error is an icon on a red tint.
      console.error(`servers.json: ${state.message}`);
      required(this, "[data-error-detail]").textContent = `servers.json: ${state.message}`;
      required(this, "[data-error]").hidden = false;
      return;
    }
    this.#servers = state.servers;
    this.#stars = starValues(state.servers);
    this.#pushed = pushedValues(state.servers);
    this.#setSlider("stars", this.#stars, formatStars);
    this.#setSlider("pushed", this.#pushed, formatMonth);
    this.#isReady = true;
    this.#render();
    this.dataset.ready = "";
  }

  #onChange(event: Event): void {
    const target = event.target as HTMLElement;
    if (event instanceof CustomEvent) {
      this.#onSlider(target, event.detail as RangeDetail);
    } else if (target.dataset.axis !== undefined) {
      this.#onAxis(target.dataset.axis, (target as HTMLSelectElement).value);
    } else if (target.dataset.export !== undefined) {
      this.#export(target as HTMLSelectElement);
    }
  }

  #onClick(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLElement>("button");
    if (button === null) return;
    const { action, coverage, option, preset, presetDelete, sortKey } = button.dataset;
    const filter = this.#filter;
    if (sortKey !== undefined) {
      this.#update(filter, { ...this.#sort, key: sortKey as SortKey });
    } else if (option !== undefined) {
      const key = button.dataset.key as TriKey;
      this.#update({ ...filter, [key]: cycle(filter[key] as TriSelect<string>, option) });
    } else if (coverage !== undefined) {
      this.#update({
        ...filter,
        gradeCoverage: filter.gradeCoverage === coverage ? null : (coverage as GradeCoverage),
      });
    } else if (preset !== undefined) {
      const decoded = decodeFilter(preset);
      this.#update(decoded.filter, decoded.sort);
    } else if (presetDelete !== undefined) {
      this.#presets = removePreset(this.#presets, presetDelete);
      this.#persistPresets();
    } else if (action !== undefined) {
      this.#onAction(action, button);
    }
  }

  #onAction(action: string, button: HTMLElement): void {
    const filter = this.#filter;
    switch (action) {
      case "copy": {
        void navigator.clipboard.writeText(globalThis.location.href);
        flashCopied(button);
        break;
      }
      case "reset": {
        this.#update(DEFAULT_FILTER);
        break;
      }
      case "sort-dir": {
        const direction: SortDirection = this.#sort.dir === "asc" ? "desc" : "asc";
        this.#update(filter, { ...this.#sort, dir: direction });
        break;
      }
      case "toggle-aaa": {
        this.#update({ ...filter, tripleA: !filter.tripleA });
        break;
      }
      case "toggle-archived": {
        this.#update({ ...filter, hideArchived: !filter.hideArchived });
        break;
      }
      default: {
        this.#update({ ...filter, official: !filter.official });
      }
    }
  }

  #onAxis(axis: string, chosen: string): void {
    // Rebuilt from entries: "any" means the axis is absent, not present-and-empty.
    const minGrades = Object.fromEntries(
      GRADE_AXES.flatMap((a) => {
        const grade = a === axis ? chosen : this.#filter.minGrades[a];
        return grade === undefined || grade === "" ? [] : [[a, grade] as const];
      }),
    );
    this.#update({ ...this.#filter, minGrades });
  }

  #onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if ("search" in input.dataset) {
      this.#update({ ...this.#filter, query: input.value });
    } else {
      requiredAs(this, '[data-preset-form] [type="submit"]', HTMLButtonElement).disabled =
        input.value.trim() === "";
    }
  }

  #onSlider(target: HTMLElement, { hi, lo }: RangeDetail): void {
    const kind = target.closest<HTMLElement>("[data-slider]")?.dataset.slider;
    const filter = this.#filter;
    if (kind === "stars") {
      // A bound at the distribution's edge means "no constraint".
      this.#update({
        ...filter,
        maxStars: hi >= nth(this.#stars, this.#stars.length - 1) ? null : hi,
        minStars: lo <= nth(this.#stars, 0) ? null : lo,
      });
    } else if (kind === "pushed") {
      this.#update({ ...filter, pushedAfter: lo <= nth(this.#pushed, 0) ? null : lo });
    }
  }

  #export(select: HTMLSelectElement): void {
    const format = select.value as "" | ExportFormat;
    select.value = "";
    if (format === "") return;
    const results = applyFilterSort(this.#servers, this.#filter, this.#sort);
    const blob = new Blob([exportServers(results, format)], { type: MIME_TYPES[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `mcp-servers.${FILE_EXTENSIONS[format]}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  #persistPresets(): void {
    savePresets(globalThis.localStorage, this.#presets);
    this.#renderPresets();
  }

  #render(): void {
    const results = applyFilterSort(this.#servers, this.#filter, this.#sort);
    const facets = computeFacets(results);
    this.#list.show(results.map((server) => server.id));
    patchFacets(this, this.#filter, facets);
    patchGrade(this, this.#filter, facets, ungradedCount(results));
    patchStat(this, this.#filter, this.#sort, {
      shown: results.length,
      total: this.#servers.length,
    });
    patchSliders(this, this.#filter);
    const search = requiredAs(this, "[data-search]", HTMLInputElement);
    if (search.value !== this.#filter.query) search.value = this.#filter.query;
  }

  #readUrl(): void {
    const state = readUrl();
    this.#filter = state.filter;
    this.#sort = state.sort;
  }

  #renderPresets(): void {
    const template = requiredAs(this, "[data-saved-template]", HTMLTemplateElement);
    const items = this.#presets.map((saved) => {
      const item = template.content.cloneNode(true) as DocumentFragment;
      const apply = required(item, "[data-preset]");
      apply.dataset.preset = saved.search;
      apply.textContent = saved.name;
      const remove = required(item, "[data-preset-delete]");
      remove.dataset.presetDelete = saved.name;
      remove.setAttribute("aria-label", `Delete preset ${saved.name}`);
      return item;
    });
    required(this, "[data-saved]").replaceChildren(...items);
  }

  #savePreset(): void {
    const input = requiredAs(this, "[data-preset-name]", HTMLInputElement);
    const name = input.value.trim();
    if (name === "") return;
    this.#presets = addPreset(this.#presets, name, this.#filter, this.#sort);
    this.#persistPresets();
    input.value = "";
    requiredAs(this, '[data-preset-form] [type="submit"]', HTMLButtonElement).disabled = true;
  }

  #setSlider(
    kind: "pushed" | "stars",
    values: readonly number[],
    format: (value: number) => string,
  ): void {
    const slider = requiredAs(this, `[data-slider="${kind}"] range-slider`, RangeSliderElement);
    slider.format = format;
    slider.values = values;
  }

  #update(filter: FilterState, sort: SortState = this.#sort): void {
    this.#filter = filter;
    this.#sort = sort;
    writeUrl(filter, sort);
    if (this.#isReady) this.#render();
  }

  public connectedCallback(): void {
    this.#readUrl();
    this.#list.refreshAges(Date.now());
    this.#presets = loadPresets(globalThis.localStorage);
    this.#renderPresets();
    this.#stopKeyboard = bindKeyboard({
      onClear: (): void => {
        required(this, "[data-help]").hidden = true;
        required(this, "[data-search]").blur();
      },
      onFocusSearch: (): void => {
        required(this, "[data-search]").focus();
      },
      onToggleHelp: (): void => {
        const help = required(this, "[data-help]");
        help.hidden = !help.hidden;
      },
      onToggleTripleA: (): void => {
        this.#update({ ...this.#filter, tripleA: !this.#filter.tripleA });
      },
    });
    globalThis.addEventListener("popstate", this.#onPopState);
    void this.#load();
  }

  public disconnectedCallback(): void {
    this.#stopKeyboard?.();
    globalThis.removeEventListener("popstate", this.#onPopState);
  }
}
