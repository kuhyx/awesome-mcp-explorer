/**
 * The virtualized result list.
 *
 * dufs-cloud renders every row directly, which is right for a folder listing
 * and wrong for 2,981 servers: each row here carries a dozen chips, so a full
 * render is tens of thousands of DOM nodes and makes every keystroke janky.
 * Only the visible window is mounted.
 */
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import type { Server } from "../lib/server.ts";

import { elementAt } from "../lib/array.ts";
import { ServerRow } from "./server-row.tsx";

/**
 * Rows vary a little with chip wrapping; the virtualizer measures the real height.
 */
const ESTIMATED_ROW_HEIGHT = 132;

export interface ServerListProps {
  readonly now: number;
  readonly servers: readonly Server[];
}

export function ServerList({ now, servers }: ServerListProps): React.JSX.Element {
  const scrollReference = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: servers.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    getScrollElement: () => scrollReference.current,
    overscan: 6,
  });

  if (servers.length === 0) {
    return (
      <div className="list-empty" ref={scrollReference}>
        <p>No servers match these filters.</p>
      </div>
    );
  }

  return (
    <div className="list" ref={scrollReference}>
      <div className="list-inner" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          // elementAt, not a guard: the virtualizer only ever yields indices
          // below `count`, so an undefined check would be a branch that can
          // never run and would silently render nothing if it ever did.
          const server = elementAt(servers, item.index);
          return (
            <div
              className="list-item"
              data-index={item.index}
              key={server.id}
              ref={(node): void => {
                virtualizer.measureElement(node);
              }}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <ServerRow now={now} server={server} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
