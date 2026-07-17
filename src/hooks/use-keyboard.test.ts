import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { actionFor, isTypingTarget, useKeyboard } from "./use-keyboard.ts";

const event = (
  over: Partial<Pick<KeyboardEvent, "ctrlKey" | "key" | "metaKey" | "target">> = {},
): Pick<KeyboardEvent, "ctrlKey" | "key" | "metaKey" | "target"> => ({
  ctrlKey: false,
  key: "a",
  metaKey: false,
  target: null,
  ...over,
});

describe("isTypingTarget", () => {
  it("is false for null and non-elements", () => {
    expect(isTypingTarget(null)).toBe(false);
  });

  it("is true for form fields", () => {
    for (const tag of ["input", "select", "textarea"]) {
      expect(isTypingTarget(document.createElement(tag))).toBe(true);
    }
  });

  it("is true for a contenteditable element", () => {
    const div = document.createElement("div");
    // jsdom does not implement isContentEditable, so set it directly.
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isTypingTarget(div)).toBe(true);
  });

  it("is false for a plain element", () => {
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
  });
});

describe("actionFor", () => {
  it("maps the shortcut keys", () => {
    expect(actionFor(event({ key: "/" }))).toBe("onFocusSearch");
    expect(actionFor(event({ key: "?" }))).toBe("onToggleHelp");
    expect(actionFor(event({ key: "a" }))).toBe("onToggleTripleA");
    expect(actionFor(event({ key: "Escape" }))).toBe("onClear");
  });

  it("ignores an unmapped key", () => {
    expect(actionFor(event({ key: "z" }))).toBeNull();
  });

  it("ignores a modified key so browser shortcuts still work", () => {
    expect(actionFor(event({ ctrlKey: true, key: "a" }))).toBeNull();
    expect(actionFor(event({ key: "a", metaKey: true }))).toBeNull();
  });

  it("does not fire while typing, so a search query cannot toggle filters", () => {
    const input = document.createElement("input");
    expect(actionFor(event({ key: "a", target: input }))).toBeNull();
    expect(actionFor(event({ key: "/", target: input }))).toBeNull();
  });

  it("still allows Escape while typing, since that is how you leave the field", () => {
    const input = document.createElement("input");
    expect(actionFor(event({ key: "Escape", target: input }))).toBe("onClear");
  });
});

describe("useKeyboard", () => {
  const actions = (): Record<string, ReturnType<typeof vi.fn>> => ({
    onClear: vi.fn(),
    onFocusSearch: vi.fn(),
    onToggleHelp: vi.fn(),
    onToggleTripleA: vi.fn(),
  });

  it("runs the mapped action on keydown", () => {
    const handlers = actions();
    renderHook(() => {
      useKeyboard(handlers as never);
    });
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(handlers["onToggleTripleA"]).toHaveBeenCalledOnce();
  });

  it("ignores an unmapped key", () => {
    const handlers = actions();
    renderHook(() => {
      useKeyboard(handlers as never);
    });
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });

  it("stops listening once unmounted", () => {
    const handlers = actions();
    const { unmount } = renderHook(() => {
      useKeyboard(handlers as never);
    });
    unmount();
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(handlers["onToggleTripleA"]).not.toHaveBeenCalled();
  });
});
