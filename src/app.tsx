/**
 * The app shell: owns nothing but wiring.
 *
 * State lives in the URL (filters/sort) or localStorage (presets); everything
 * below is derived and memoised. This follows dufs-cloud's single-owner
 * prop-drilling shape rather than a store — with one owner and one level of
 * children, a store would be ceremony.
 */
import {
  useCallback,
  useDeferredValue,

  useMemo,
  useRef,
  useState,
} from "react";

import type { ExportFormat } from "./lib/export.ts";
import type { Preset } from "./lib/presets.ts";

import { FilterBar } from "./components/filter-bar.tsx";
import { PresetMenu } from "./components/preset-menu.tsx";
import { ServerList } from "./components/server-list.tsx";
import { StatBar } from "./components/stat-bar.tsx";
import { useKeyboard } from "./hooks/use-keyboard.ts";
import { useServers } from "./hooks/use-servers.ts";
import { useUrlFilter } from "./hooks/use-url-filter.ts";
import { exportServers, FILE_EXTENSIONS, MIME_TYPES } from "./lib/export.ts";
import { computeFacets, pushedValues, starValues, ungradedCount } from "./lib/facets.ts";
import { applyFilterSort, DEFAULT_FILTER, isFilterActive } from "./lib/filter-sort.ts";
import { addPreset, applyPreset, loadPresets, removePreset, savePresets } from "./lib/presets.ts";

export function App(): React.JSX.Element {
  const state = useServers();
  const { filter, setBoth, setFilter, setSort, sort } = useUrlFilter();
  const [presets, setPresets] = useState<Preset[]>(() =>
    loadPresets(globalThis.localStorage),
  );
  const [showHelp, setShowHelp] = useState(false);
  const searchReference = useRef<HTMLInputElement>(null);

  useKeyboard(
    useMemo(
      () => {
      	return {
	        onClear: (): void => {
	          setShowHelp(false);
	          searchReference.current?.blur();
	        },
	        onFocusSearch: (): void => searchReference.current?.focus(),
	        onToggleHelp: (): void => {
	          setShowHelp((open) => !open);
	        },
	        onToggleTripleA: (): void => {
	          setFilter({ ...filter, tripleA: !filter.tripleA });
	        },
	      };
      },
      [filter, setFilter],
    ),
  );

  // Search runs over ~3,000 rows on every keystroke. Deferring it keeps the
  // input responsive while the list catches up.
  const deferredFilter = useDeferredValue(filter);
  const servers = state.kind === "ready" ? state.servers : [];

  const results = useMemo(
    () => applyFilterSort(servers, deferredFilter, sort),
    [servers, deferredFilter, sort],
  );

  // Facets are computed from the results, so each option's count reflects what
  // clicking it would actually leave you with.
  const facets = useMemo(() => computeFacets(results), [results]);
  const stars = useMemo(() => starValues(servers), [servers]);
  const pushed = useMemo(() => pushedValues(servers), [servers]);
  const ungraded = useMemo(() => ungradedCount(results), [results]);
  const categories = useMemo(
    () => {
    	return [...new Set(servers.flatMap((s) => s.categories))].toSorted((a, b) =>
        a.localeCompare(b),
      );
    },
    [servers],
  );
  // Read once, via a lazy initialiser rather than useMemo or an effect.
  // Date.now() is impure, and the React Compiler is entitled to re-run or
  // memoise render as it pleases; a useState initialiser is the one place React
  // guarantees exactly-once. Row ages are relative to page load, which is what
  // "3d ago" should mean anyway.
  const [now] = useState(() => Date.now());

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const blob = new Blob([exportServers(results, format)], {
        type: MIME_TYPES[format],
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `mcp-servers.${FILE_EXTENSIONS[format]}`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    },
    [results],
  );

  const handleShare = useCallback(() => {
    void navigator.clipboard.writeText(globalThis.location.href);
  }, []);

  const handleSavePreset = useCallback(
    (name: string) => {
      const next = addPreset(presets, name, filter, sort);
      setPresets(next);
      savePresets(globalThis.localStorage, next);
    },
    [filter, presets, sort],
  );

  const handleDeletePreset = useCallback(
    (name: string) => {
      const next = removePreset(presets, name);
      setPresets(next);
      savePresets(globalThis.localStorage, next);
    },
    [presets],
  );

  const handleApplyPreset = useCallback(
    (preset: Preset) => {
      const decoded = applyPreset(preset);
      // Both at once: two separate writes would leave the second closing over
      // the first's stale value and silently undo it.
      setBoth(decoded.filter, decoded.sort);
    },
    [setBoth],
  );

  if (state.kind === "loading") {
    return <main className="app-msg">Loading servers…</main>;
  }
  if (state.kind === "error") {
    return (
      <main className="app-msg">
        <p>Could not load servers.json: {state.message}</p>
        <p>Run `pnpm run build:data` to generate it.</p>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          MCP Explorer <span className="subtitle">{servers.length} servers</span>
        </h1>
        <input
          aria-label="Search servers"
          className="search"
          onChange={(event): void => {
            setFilter({ ...filter, query: event.target.value });
          }}
          placeholder="Fuzzy search name or description…  (/)"
          ref={searchReference}
          type="search"
          value={filter.query}
        />
        <PresetMenu
          onApply={handleApplyPreset}
          onDelete={handleDeletePreset}
          onSave={handleSavePreset}
          presets={presets}
        />
      </header>

      <StatBar
        filterActive={isFilterActive(filter)}
        onExport={handleExport}
        onReset={(): void => {
          setFilter(DEFAULT_FILTER);
        }}
        onShare={handleShare}
        onSort={setSort}
        shown={results.length}
        sort={sort}
        total={servers.length}
      />

      <div className="body">
        <FilterBar
          categories={categories}
          facets={facets}
          filter={filter}
          onChange={setFilter}
          pushedValues={pushed}
          starValues={stars}
          ungraded={ungraded}
        />
        <ServerList now={now} servers={results} />
      </div>

      {showHelp && (
        <div className="help" role="dialog">
          <h2>Shortcuts</h2>
          <dl>
            <dt>/</dt>
            <dd>focus search</dd>
            <dt>a</dt>
            <dd>toggle Triple-A</dd>
            <dt>Esc</dt>
            <dd>leave search / close this</dd>
            <dt>?</dt>
            <dd>this help</dd>
          </dl>
          <p>
            Every filter lives in the URL, so the address bar is always a
            shareable link.
          </p>
        </div>
      )}
    </div>
  );
}
