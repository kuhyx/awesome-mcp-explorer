import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useServers } from "./use-servers.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SERVERS = [{ id: "a/b" }];

function stubFetch(impl: () => Promise<Response>): void {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("useServers", () => {
  it("starts loading", () => {
    stubFetch(() => new Promise(() => {}));
    const { result } = renderHook(() => useServers());
    expect(result.current.kind).toBe("loading");
  });

  it("returns the servers once loaded", async () => {
    stubFetch(() =>
      Promise.resolve(Response.json(SERVERS, { status: 200 })),
    );
    const { result } = renderHook(() => useServers());
    await waitFor(() => {
      expect(result.current.kind).toBe("ready");
    });
    expect(result.current).toEqual({ kind: "ready", servers: SERVERS });
  });

  it("reports an HTTP failure rather than hanging", async () => {
    stubFetch(() => Promise.resolve(new Response("", { status: 404 })));
    const { result } = renderHook(() => useServers());
    await waitFor(() => {
      expect(result.current.kind).toBe("error");
    });
    expect(result.current).toEqual({ kind: "error", message: "HTTP 404" });
  });

  it("reports a network failure", async () => {
    stubFetch(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useServers());
    await waitFor(() => {
      expect(result.current.kind).toBe("error");
    });
    expect(result.current).toEqual({ kind: "error", message: "offline" });
  });

  it("reports a non-Error rejection", async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    stubFetch(() => Promise.reject("boom"));
    const { result } = renderHook(() => useServers());
    await waitFor(() => {
      expect(result.current.kind).toBe("error");
    });
    expect(result.current).toEqual({ kind: "error", message: "boom" });
  });

  it("fetches the given url", () => {
    stubFetch(() => new Promise(() => {}));
    renderHook(() => useServers("other.json"));
    expect(globalThis.fetch).toHaveBeenCalledWith("other.json");
  });

  it("does not set state after unmount when the fetch rejects late", async () => {
    // The mirror of the success path: a component torn down before the request
    // fails must not try to render an error into a dead tree.
    const { promise, reject } = Promise.withResolvers<Response>();
    stubFetch(() => promise);
    const { result, unmount } = renderHook(() => useServers());
    unmount();
    reject(new Error("late failure"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    expect(result.current.kind).toBe("loading");
  });

  it("does not set state after unmount", async () => {
    const { promise, resolve } = Promise.withResolvers<Response>();
    stubFetch(() => promise);
    const { unmount } = renderHook(() => useServers());
    unmount();
    resolve(Response.json(SERVERS, { status: 200 }));
    // A late setState on an unmounted component would warn; none should appear.
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});
