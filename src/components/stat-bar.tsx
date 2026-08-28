/**
 * The result count, sort control, share link and export menu.
 */
import type { ExportFormat } from "../lib/export.ts";
import type { SortKey, SortState } from "../lib/filter-sort.ts";

const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  category: "category",
  created: "age",
  grade: "grade",
  name: "name",
  pushed: "last push",
  stars: "stars",
};

export interface StatBarProps {
  readonly filterActive: boolean;
  readonly onExport: (format: ExportFormat) => void;
  readonly onReset: () => void;
  readonly onShare: () => void;
  readonly onSort: (next: SortState) => void;
  readonly shown: number;
  readonly sort: SortState;
  readonly total: number;
}

export function StatBar({
  filterActive,
  onExport,
  onReset,
  onShare,
  onSort,
  shown,
  sort,
  total,
}: StatBarProps): React.JSX.Element {
  return (
    <div className="statbar">
      <span className="count" role="status">
        Showing <strong>{shown.toLocaleString()}</strong> of {total.toLocaleString()}
      </span>

      <label className="sort">
        Sort
        <select
          onChange={(event): void => {
            onSort({ ...sort, key: event.target.value as SortKey });
          }}
          value={sort.key}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
            return (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            );
          })}
        </select>
        <button
          aria-label={`Sort ${sort.dir === "asc" ? "ascending" : "descending"}`}
          className="chip"
          onClick={(): void => {
            onSort({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" });
          }}
          type="button"
        >
          {sort.dir === "asc" ? "↑" : "↓"}
        </button>
      </label>

      <div className="statbar-actions">
        {filterActive && (
          <button className="chip" onClick={onReset} type="button">
            Reset
          </button>
        )}
        <button className="chip" onClick={onShare} type="button">
          Copy link
        </button>
        <label className="sort">
          Export
          <select
            onChange={(event): void => {
              const value = event.target.value;
              if (value === "") return;
              onExport(value as ExportFormat);
              event.target.value = "";
            }}
            value=""
          >
            <option value="">…</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="markdown">Markdown</option>
          </select>
        </label>
      </div>
    </div>
  );
}
