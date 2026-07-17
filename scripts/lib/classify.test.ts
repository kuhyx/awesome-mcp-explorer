import { describe, expect, it } from "vitest";

import {
  classifyFoss,
  inferCost,
  inferRateLimited,
  isUnrecognisedLicense,
} from "./classify.ts";

describe("classifyFoss", () => {
  it("accepts permissive and copyleft licences alike", () => {
    for (const spdx of ["MIT", "Apache-2.0", "ISC", "GPL-3.0", "AGPL-3.0", "MPL-2.0"]) {
      expect(classifyFoss(spdx)).toBe("yes");
    }
  });

  it("rejects source-available licences", () => {
    // PolyForm is not hypothetical: it appears in the real list.
    expect(classifyFoss("PolyForm-Noncommercial-1.0.0")).toBe("no");
    expect(classifyFoss("BUSL-1.1")).toBe("no");
    expect(classifyFoss("SSPL-1.0")).toBe("no");
  });

  it("treats a missing licence as not free, since that means all rights reserved", () => {
    expect(classifyFoss(null)).toBe("no");
    expect(classifyFoss("NONE")).toBe("no");
  });

  it("treats an unidentifiable licence file as unknown, not as missing", () => {
    // GitHub returns NOASSERTION when a LICENSE exists but it cannot name it.
    // That is "we could not tell", which is different from "there is none".
    expect(classifyFoss("NOASSERTION")).toBe("unknown");
  });

  it("returns unknown for a licence it does not classify rather than guessing", () => {
    expect(classifyFoss("Sleepycat")).toBe("unknown");
  });
});

describe("isUnrecognisedLicense", () => {
  it("flags an id absent from both lists so the build can report it", () => {
    expect(isUnrecognisedLicense("Sleepycat")).toBe(true);
  });

  it("does not flag classified, missing or unidentifiable licences", () => {
    expect(isUnrecognisedLicense("MIT")).toBe(false);
    expect(isUnrecognisedLicense("BUSL-1.1")).toBe(false);
    expect(isUnrecognisedLicense(null)).toBe(false);
    expect(isUnrecognisedLicense("NONE")).toBe(false);
    expect(isUnrecognisedLicense("NOASSERTION")).toBe(false);
  });
});

describe("inferCost", () => {
  it("reads an explicit no-key claim as free", () => {
    expect(inferCost("Weather data, no API key required.", ["cloud"])).toBe(
      "likely-free",
    );
  });

  it("does not let 'api key' inside 'no api key' flip the answer", () => {
    // The trap: 120 entries say "no api key" and a naive substring check on
    // "api key" would call every one of them paid.
    expect(inferCost("Search with no api key needed", ["cloud"])).toBe(
      "likely-free",
    );
  });

  it("reads pricing vocabulary as paid", () => {
    expect(inferCost("See our pricing page for details.", ["cloud"])).toBe(
      "likely-paid",
    );
    expect(inferCost("Requires a paid plan.", ["cloud"])).toBe("likely-paid");
  });

  it("reads a cloud service needing a credential as probably paid", () => {
    expect(inferCost("Talks to the Acme API. Requires an API key.", ["cloud"])).toBe(
      "likely-paid",
    );
  });

  it("does not treat payment vocabulary as a price signal", () => {
    // coinopai-mcp: "x402 micropayments, USDC/Base" describes the server's
    // domain, not its cost. 92 entries mention usd and 88 payment for the same
    // reason.
    expect(
      inferCost("Crypto signals and trade decisions. x402 micropayments, USDC/Base.", [
        "cloud",
      ]),
    ).toBe("unknown");
  });

  it("treats a local-only server as probably free", () => {
    expect(inferCost("Takes control of your local Chrome.", ["local"])).toBe(
      "likely-free",
    );
  });

  it("does not call a local server paid just because it wants a key", () => {
    // A local server may want a key for software on your own machine.
    expect(inferCost("Controls local Plex. Needs an API key.", ["local"])).toBe(
      "likely-free",
    );
  });

  it("returns unknown when nothing indicates either way", () => {
    expect(inferCost("An MCP server for widgets.", ["cloud"])).toBe("unknown");
    expect(inferCost("An MCP server for widgets.", [])).toBe("unknown");
  });
});

describe("inferRateLimited", () => {
  it("believes an explicit rate-limit mention", () => {
    expect(inferRateLimited("Note: rate limited to 10 rps.", ["cloud"])).toBe("yes");
    expect(inferRateLimited("Has a rate-limit.", ["cloud"])).toBe("yes");
  });

  it("treats a local-only server as not rate limited", () => {
    expect(inferRateLimited("Controls local Chrome.", ["local"])).toBe("no");
  });

  it("treats a local-only keyless server as not rate limited", () => {
    expect(inferRateLimited("Fully local, no api key.", ["local"])).toBe("no");
  });

  it("treats a credentialed cloud service as probably rate limited", () => {
    expect(inferRateLimited("Requires an API key for the Acme API.", ["cloud"])).toBe(
      "yes",
    );
  });

  it("returns unknown when nothing indicates either way", () => {
    expect(inferRateLimited("An MCP server for widgets.", ["cloud"])).toBe("unknown");
  });
});
