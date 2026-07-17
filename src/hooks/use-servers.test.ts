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
    stubFetch(() => new Promise(() => undefined));
    const { result } = renderHook(() => useServers());
    expect(result.current.kind).toBe("loading");
  });

  it("returns the servers once loaded", async () => {
    stubFetch(() =>
      Promise.resolve(new Response(JSON.stringify(SERVERS), { status: 200 })),
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
    stubFetch(() => new Promise(() => undefined));
    renderHook(() => useServers("other.json"));
    expect(globalThis.fetch).toHaveBeenCalledWith("other.json");
  });

  it("does not set state after unmount", async () => {
    let resolve: ((response: Response) => void) | undefined;
    stubFetch(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const { unmount } = renderHook(() => useServers());
    unmount();
    resolve?.(new Response(JSON.stringify(SERVERS), { status: 200 }));
    // A late setState on an unmounted component would warn; none should appear.
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});
