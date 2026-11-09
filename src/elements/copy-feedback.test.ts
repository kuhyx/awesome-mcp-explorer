import { afterEach, describe, expect, it, vi } from "vitest";

import { COPIED_MS, flashCopied } from "./copy-feedback.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("flashCopied", () => {
  it("marks the button for about 1.5 s, then clears it", () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    flashCopied(button);
    expect(button).toHaveAttribute("data-copied");
    vi.advanceTimersByTime(COPIED_MS - 1);
    expect(button).toHaveAttribute("data-copied");
    vi.advanceTimersByTime(1);
    expect(button).not.toHaveAttribute("data-copied");
  });

  it("restarts the window on a second click", () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    flashCopied(button);
    vi.advanceTimersByTime(1000);
    flashCopied(button);
    vi.advanceTimersByTime(1000);
    expect(button).toHaveAttribute("data-copied");
    vi.advanceTimersByTime(500);
    expect(button).not.toHaveAttribute("data-copied");
  });
});
