import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
});

// jsdom implements no layout engine: every element reports a zero-sized rect and
// ResizeObserver does not exist at all. @tanstack/react-virtual needs both to
// decide which rows are on screen, so without these stubs it windows down to
// zero rows and every list test renders empty.
//
// The measurements below are fictional but internally consistent: an 800px-tall
// scroller over 64px rows, which yields a stable ~13-row window in tests.
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

Reflect.set(globalThis, "localStorage", new MemoryStorage());

class ResizeObserverStub implements ResizeObserver {
  disconnect(): void {
    // No layout in jsdom, so nothing is ever observed and nothing to tear down.
  }
  observe(): void {
    // Intentionally inert: sizes come from the clientHeight stub below.
  }
  unobserve(): void {
    // Intentionally inert.
  }
}

Reflect.set(globalThis, "ResizeObserver", ResizeObserverStub);

/** Viewport height every element reports; tests may change it via {@link setTestHeight}. */
let testHeight = 800;

/** Resize the fake viewport to exercise a different virtual window. */
export function setTestHeight(height: number): void {
  testHeight = height;
}

/** Height a virtualized row reports. Mirrors ESTIMATED_ROW_HEIGHT. */
const ROW_HEIGHT = 132;

/** True for the scrolling viewport, false for a row inside it. */
function isScroller(element: Element): boolean {
  return element.classList.contains("list");
}

function heightOf(element: Element): number {
  return isScroller(element) ? testHeight : ROW_HEIGHT;
}

// jsdom implements no layout: every size is 0 and there is no ResizeObserver.
// @tanstack/react-virtual therefore concludes the viewport is zero pixels tall
// and renders no rows at all, so an unstubbed list test asserts against an
// empty DOM rather than against the component.
//
// It reads three separate things, and all three must be stubbed — the first
// attempt only patched getBoundingClientRect and still rendered nothing:
//   - the viewport, via offsetWidth/offsetHeight (virtual-core's `getRect`)
//   - the scroll position, via scrollTop
//   - each row, via getBoundingClientRect (`measureElement`)
//
// The numbers below are what a browser would report: an 800px scroller over
// 132px rows, which yields a stable ~13-row window.
Object.defineProperties(HTMLElement.prototype, {
  clientHeight: { configurable: true, get: (): number => testHeight },
  clientWidth: { configurable: true, get: (): number => 1200 },
  offsetHeight: {
    configurable: true,
    get(this: HTMLElement): number {
      return heightOf(this);
    },
  },
  offsetWidth: { configurable: true, get: (): number => 1200 },
  scrollTop: { configurable: true, get: (): number => 0, set: (): void => {} },
});

Object.defineProperty(Element.prototype, "getBoundingClientRect", {
  configurable: true,
  value(this: Element): DOMRect {
    const height = heightOf(this);
    return {
      bottom: height,
      height,
      left: 0,
      right: 1200,
      toJSON: () => ({}),
      top: 0,
      width: 1200,
      x: 0,
      y: 0,
    };
  },
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
