import { afterEach, describe, expect, it, vi } from "vitest";

import { SERVERS } from "../test/fixtures.ts";
import { loadServers } from "./load-servers.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadServers", () => {
  it("returns the validated servers", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(Response.json(SERVERS)));
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadServers("data.json");
    expect(state.kind).toBe("ready");
    expect(state.kind === "ready" && state.servers).toHaveLength(SERVERS.length);
    expect(fetchMock).toHaveBeenCalledWith("data.json");
  });

  it("defaults to servers.json next to the page", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(Response.json([])));
    vi.stubGlobal("fetch", fetchMock);
    await loadServers();
    expect(fetchMock).toHaveBeenCalledWith("servers.json");
  });

  it("reports an HTTP failure rather than hanging", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("", { status: 404 })));
    expect(await loadServers()).toEqual({ kind: "error", message: "HTTP 404" });
  });

  it("reports a network failure", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    expect(await loadServers()).toEqual({ kind: "error", message: "Failed to fetch" });
  });

  it("reports a non-Error rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("boom"));
    expect(await loadServers()).toEqual({ kind: "error", message: "boom" });
  });

  it("reports a file that is not a server list", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json({ oops: true })));
    expect(await loadServers()).toEqual({
      kind: "error",
      message: "servers.json is not a list of servers",
    });
  });
});
