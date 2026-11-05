import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
});

// Node 26 defines its own experimental `localStorage` global, which shadows the
// one jsdom installs — and it is disabled unless the process is started with
// --localstorage-file, so both end up undefined. An in-memory Storage restores
// the browser behaviour the app expects.
//
// (The app itself survives a missing localStorage: loadPresets/savePresets wrap
// every access in try/catch precisely because private browsing throws too. This
// stub is so tests exercise the working path rather than only the fallback.)
class MemoryStorage implements Storage {
  readonly #items = new Map<string, string>();

  get length(): number {
    return this.#items.size;
  }

  clear(): void {
    this.#items.clear();
  }

  getItem(key: string): null | string {
    return this.#items.get(key) ?? null;
  }

  key(index: number): null | string {
    return this.#items.keys().toArray()[index] ?? null;
  }

  removeItem(key: string): void {
    this.#items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#items.set(key, value);
  }
}

// jsdom (via vitest 5) exposes localStorage as a getter-only accessor, so a
// jsdom (via vitest 5) exposes localStorage as a getter-only accessor, so a
// plain assignment throws; redefine the property instead.
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: new MemoryStorage(),
  writable: true,
});

// The quantile range slider uses pointer capture, which jsdom also lacks.
Object.defineProperties(Element.prototype, {
  releasePointerCapture: {
    configurable: true,
    value: (): void => {
      // No pointer capture in jsdom; the slider only needs the call to not throw.
    },
  },
  setPointerCapture: {
    configurable: true,
    value: (): void => {
      // As above.
    },
  },
});
