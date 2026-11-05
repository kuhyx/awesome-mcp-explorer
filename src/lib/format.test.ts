import { describe, expect, it } from "vitest";

import { formatAge, formatDate, formatMonth, formatStars } from "./format.ts";

const NOW = Date.parse("2026-07-10T00:00:00Z");

describe("formatStars", () => {
  it("shows small counts exactly", () => {
    expect(formatStars(0)).toBe("0");
    expect(formatStars(999)).toBe("999");
  });

  it("abbreviates thousands with one decimal", () => {
    expect(formatStars(1000)).toBe("1.0k");
    expect(formatStars(9500)).toBe("9.5k");
  });

  it("drops the decimal past ten thousand", () => {
    expect(formatStars(59_300)).toBe("59k");
  });
});

describe("formatAge", () => {
  it("says today for the last day", () => {
    expect(formatAge("2026-07-09T12:00:00Z", NOW)).toBe("today");
  });

  it("counts days, months and years", () => {
    expect(formatAge("2026-07-07T00:00:00Z", NOW)).toBe("3d ago");
    expect(formatAge("2026-04-10T00:00:00Z", NOW)).toBe("3mo ago");
    expect(formatAge("2023-07-09T00:00:00Z", NOW)).toBe("3y ago");
  });

  it("says unknown for an unparseable date", () => {
    expect(formatAge("not a date", NOW)).toBe("unknown");
  });
});

describe("formatMonth and formatDate", () => {
  it("cuts an instant down to month and day", () => {
    expect(formatMonth(Date.parse("2026-07-15T00:00:00Z"))).toBe("2026-07");
    expect(formatDate("2026-07-15T08:30:00Z")).toBe("2026-07-15");
  });
});
