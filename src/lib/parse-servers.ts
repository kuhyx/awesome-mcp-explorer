/**
 * Validation for `servers.json`, shared by the build-time read and the
 * browser fetch. Kept free of Node imports so the client bundle can use it.
 */
import type { Server } from "./server.ts";

function isServerLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<Server>).id === "string" &&
    typeof (value as Partial<Server>).url === "string"
  );
}

/**
 * Narrows parsed JSON to a server list, or throws a readable error.
 */
export function parseServers(value: unknown): Server[] {
  if (!Array.isArray(value) || value.some((item) => !isServerLike(item))) {
    throw new TypeError("servers.json is not a list of servers");
  }
  return value as Server[];
}

