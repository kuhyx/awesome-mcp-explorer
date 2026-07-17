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

Object.defineProperties(HTMLElement.prototype, {
  clientHeight: {
    configurable: true,
    get: (): number => testHeight,
  },
  clientWidth: {
    configurable: true,
    get: (): number => 1200,
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
