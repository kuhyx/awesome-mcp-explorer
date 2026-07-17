import { describe, expect, it, vi } from "vitest";

import type { Preset } from "./presets.ts";

import { DEFAULT_FILTER, DEFAULT_SORT } from "./filter-sort.ts";
import {
  addPreset,
  applyPreset,
  BUILTIN_PRESETS,
  loadPresets,
  removePreset,
  savePresets,
} from "./presets.ts";

/** A minimal in-memory Storage, so tests do not depend on jsdom's. */
function fakeStorage(initial: null | string = null): Storage {
  let value = initial;
  return {
    clear: vi.fn(),
    getItem: vi.fn(() => value),
    key: vi.fn(),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
  } as unknown as Storage;
}

function throwingStorage(): Storage {
  return {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  } as unknown as Storage;
}

describe("loadPresets", () => {
  it("returns nothing when there is no saved data", () => {
    expect(loadPresets(fakeStorage())).toEqual([]);
  });

  it("reads saved presets", () => {
    const stored = JSON.stringify([{ name: "Mine", search: "aaa=1" }]);
    expect(loadPresets(fakeStorage(stored))).toEqual([
      { name: "Mine", search: "aaa=1" },
    ]);
  });

  it("returns nothing for malformed JSON rather than throwing", () => {
    expect(loadPresets(fakeStorage("{not json"))).toEqual([]);
  });

  it("returns nothing when the stored value is not a list", () => {
    expect(loadPresets(fakeStorage('{"a":1}'))).toEqual([]);
  });

  it("drops entries that are not presets", () => {
    const stored = JSON.stringify([
      { name: "Good", search: "aaa=1" },
      { name: "No search" },
      { search: "no name" },
      null,
      "string",
      42,
    ]);
    expect(loadPresets(fakeStorage(stored))).toEqual([
      { name: "Good", search: "aaa=1" },
    ]);
  });

  it("survives storage being unavailable", () => {
    // Private browsing throws on access rather than returning null.
    expect(loadPresets(throwingStorage())).toEqual([]);
  });
});

describe("savePresets", () => {
  it("writes presets as JSON", () => {
    const storage = fakeStorage();
    savePresets(storage, [{ name: "Mine", search: "aaa=1" }]);
    expect(storage.setItem).toHaveBeenCalledWith(
      "awesome-mcp-explorer:presets",
      JSON.stringify([{ name: "Mine", search: "aaa=1" }]),
    );
  });

  it("swallows a quota error rather than taking down the page", () => {
    expect(() => {
      savePresets(throwingStorage(), [{ name: "x", search: "" }]);
    }).not.toThrow();
  });

  it("round-trips through storage", () => {
    const storage = fakeStorage();
    const presets: Preset[] = [{ name: "Mine", search: "aaa=1&foss=yes" }];
    savePresets(storage, presets);
    expect(loadPresets(storage)).toEqual(presets);
  });
});

describe("addPreset", () => {
  it("stores the encoded search, not the state object", () => {
    const [preset] = addPreset(
      [],
      "AAA",
      { ...DEFAULT_FILTER, tripleA: true },
      DEFAULT_SORT,
    );
    expect(preset).toEqual({ name: "AAA", search: "aaa=1" });
  });

  it("replaces a preset with the same name instead of duplicating it", () => {
    const first = addPreset([], "P", { ...DEFAULT_FILTER, tripleA: true }, DEFAULT_SORT);
    const second = addPreset(
      first,
      "P",
      { ...DEFAULT_FILTER, official: true },
      DEFAULT_SORT,
    );
    expect(second).toEqual([{ name: "P", search: "official=1" }]);
  });

  it("keeps other presets", () => {
    const existing: Preset[] = [{ name: "Other", search: "foss=yes" }];
    const result = addPreset(existing, "New", DEFAULT_FILTER, DEFAULT_SORT);
    expect(result.map((p) => p.name)).toEqual(["Other", "New"]);
  });
});

describe("removePreset", () => {
  it("removes by name", () => {
    const presets: Preset[] = [
      { name: "A", search: "" },
      { name: "B", search: "" },
    ];
    expect(removePreset(presets, "A")).toEqual([{ name: "B", search: "" }]);
  });

  it("is a no-op for an unknown name", () => {
    const presets: Preset[] = [{ name: "A", search: "" }];
    expect(removePreset(presets, "Z")).toEqual(presets);
  });
});

describe("applyPreset", () => {
  it("expands a preset back into filter state", () => {
    const { filter } = applyPreset({ name: "x", search: "aaa=1&foss=yes" });
    expect(filter.tripleA).toBe(true);
    expect(filter.foss).toBe("yes");
  });

  it("round-trips add -> apply", () => {
    const filter = { ...DEFAULT_FILTER, minStars: 100, tripleA: true };
    const [preset] = addPreset([], "P", filter, DEFAULT_SORT);
    expect(applyPreset(preset!).filter).toEqual(filter);
  });
});

describe("BUILTIN_PRESETS", () => {
  it("all decode to a usable filter", () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(() => applyPreset(preset)).not.toThrow();
    }
  });

  it("actually set what their names claim", () => {
    const byName = (name: string): Preset =>
      BUILTIN_PRESETS.find((p) => p.name === name)!;
    expect(applyPreset(byName("Triple-A only")).filter.tripleA).toBe(true);
    expect(applyPreset(byName("Triple-A + FOSS")).filter.foss).toBe("yes");
    expect(applyPreset(byName("Official implementations")).filter.official).toBe(true);
    expect(applyPreset(byName("Local-only, no cloud")).filter.scope).toEqual({
      excludes: ["cloud"],
      includes: ["local"],
    });
    expect(applyPreset(byName("Rust servers")).filter.languages.includes).toEqual([
      "rust",
    ]);
    expect(applyPreset(byName("Actively maintained")).sort.key).toBe("pushed");
  });
});
