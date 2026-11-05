import { describe, expect, it, vi } from "vitest";

import { actionFor, bindKeyboard, isTypingTarget } from "./keyboard.ts";

type Keys = Pick<KeyboardEvent, "ctrlKey" | "key" | "metaKey" | "target">;

function event(over: Partial<Keys> = {}): Keys {
  return { ctrlKey: false, key: "a", metaKey: false, target: null, ...over };
}

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

describe("bindKeyboard", () => {
  function actions() {
    return {
      onClear: vi.fn(),
      onFocusSearch: vi.fn(),
      onToggleHelp: vi.fn(),
      onToggleTripleA: vi.fn(),
    };
  }

  it("runs the mapped action and swallows the key", () => {
    const handlers = actions();
    const stop = bindKeyboard(handlers);
    const press = new KeyboardEvent("keydown", { cancelable: true, key: "a" });
    globalThis.dispatchEvent(press);
    expect(handlers.onToggleTripleA).toHaveBeenCalledOnce();
    expect(press.defaultPrevented).toBe(true);
    stop();
  });

  it("lets an unmapped key through", () => {
    const handlers = actions();
    const stop = bindKeyboard(handlers);
    const press = new KeyboardEvent("keydown", { cancelable: true, key: "z" });
    globalThis.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(false);
    stop();
  });

  it("stops listening once unbound", () => {
    const handlers = actions();
    bindKeyboard(handlers)();
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(handlers.onToggleTripleA).not.toHaveBeenCalled();
  });
});
