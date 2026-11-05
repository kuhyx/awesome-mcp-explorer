/**
 * The prerendered rows, shown, hidden and reordered in place: a keystroke costs
 * some `hidden` toggles plus, only when the sort changed, one `append`.
 */
import { formatAge } from "../lib/format.ts";
import { required } from "./dom.ts";

interface Rows {
  readonly byId: Map<string, HTMLElement>;
  readonly empty: HTMLElement;
  readonly list: HTMLElement;
  order: HTMLElement[];
}

function collect(root: ParentNode): Rows {
  const list = required(root, "[data-list]");
  const order = [...list.querySelectorAll<HTMLElement>("[data-id]")];
  return {
    byId: new Map(order.map((row) => [String(row.dataset.id), row])),
    empty: required(list, "[data-empty]"),
    list,
    order,
  };
}

export class ListView {
  #rows: Rows | undefined;
  readonly #root: ParentNode;

  // Rows are looked up on first use so this can be built before children parse.
  public constructor(root: ParentNode) {
    this.#root = root;
  }

  #all(): Rows {
    this.#rows ??= collect(this.#root);
    return this.#rows;
  }

  public refreshAges(now: number): void {
    for (const time of this.#all().list.querySelectorAll("time.row-age")) {
      time.textContent = formatAge(time.getAttribute("datetime") ?? "", now);
    }
  }

  public show(ids: readonly string[]): void {
    const rows = this.#all();
    const wanted = new Set(ids);
    let isToggled = false;
    for (const [id, row] of rows.byId) {
      const shouldHide = !wanted.has(id);
      if (row.hidden === shouldHide) continue;
      row.hidden = shouldHide;
      isToggled = true;
    }

    const shown = ids.flatMap((id) => rows.byId.get(id) ?? []);
    const visible = rows.order.filter((row) => !row.hidden);
    const isReordered = visible.some((row, index) => row !== shown[index]);
    if (isReordered) {
      const hidden = rows.order.filter((row) => row.hidden);
      rows.list.append(...shown);
      rows.order = [...hidden, ...shown];
    }

    rows.empty.hidden = shown.length > 0;
    if (isToggled || isReordered) rows.list.scrollTop = 0;
  }
}
