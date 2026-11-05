import { describe, expect, it } from "vitest";

import { fragmentOf } from "../test/html.ts";
import { required, requiredAs, setNumberAttribute } from "./dom.ts";

describe("required", () => {
  it("finds an element", () => {
    const root = document.createElement("div");
    root.append(fragmentOf('<p class="x"></p>'));
    expect(required(root, ".x").tagName).toBe("P");
    expect(requiredAs(root, ".x", HTMLParagraphElement)).toBeInstanceOf(HTMLParagraphElement);
  });

  it("names the missing hook when markup lost it", () => {
    expect(() => required(document.createElement("div"), "[data-x]")).toThrow(
      "markup is missing [data-x]",
    );
  });
});

describe("requiredAs", () => {
  it("rejects an element of the wrong kind", () => {
    const root = document.createElement("div");
    root.append(fragmentOf('<p class="x"></p>'));
    expect(() => requiredAs(root, ".x", HTMLInputElement)).toThrow("markup is missing .x");
  });
});

describe("setNumberAttribute", () => {
  it("sets a number and removes on null", () => {
    const element = document.createElement("div");
    setNumberAttribute(element, "lo", 5);
    expect(element.getAttribute("lo")).toBe("5");
    setNumberAttribute(element, "lo", null);
    expect(element.hasAttribute("lo")).toBe(false);
  });
});
