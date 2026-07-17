import { describe, expect, it } from "vitest";

import type { RawEntry } from "./parse-readme.ts";

import { mergeEntries, parseReadme, parseRepoUrl } from "./parse-readme.ts";

/** Wraps entry lines in the section heading the parser requires. */
function md(...lines: string[]): string {
  return ["## Server Implementations", "", ...lines].join("\n");
}

function only(...lines: string[]): RawEntry {
  const entries = parseReadme(md(...lines));
  expect(entries).toHaveLength(1);
  return entries[0]!;
}

describe("parseRepoUrl", () => {
  it("splits owner and repo", () => {
    expect(parseRepoUrl("https://github.com/foo/bar")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("ignores deep links and fragments", () => {
    expect(parseRepoUrl("https://github.com/foo/bar/tree/main#readme")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("strips a .git suffix", () => {
    expect(parseRepoUrl("https://github.com/foo/bar.git")?.repo).toBe("bar");
  });

  it("rejects a non-repo URL", () => {
    expect(parseRepoUrl("https://github.com/foo")).toBeNull();
    expect(parseRepoUrl("https://example.com/foo/bar")).toBeNull();
  });
});

describe("parseReadme sections", () => {
  it("ignores entries outside Server Implementations", () => {
    const markdown = [
      "## Legend",
      "* 🎖️ – official implementation",
      "- [not/aserver](https://github.com/not/aserver) 🐍 ☁️ - Legend noise.",
      "## Server Implementations",
      "### 🔗 <a name=\"aggregators\"></a>Aggregators",
      "- [real/server](https://github.com/real/server) 🐍 - Real.",
    ].join("\n");
    const entries = parseReadme(markdown);
    expect(entries.map((entry) => entry.id)).toEqual(["real/server"]);
  });

  it("strips the anchor tag and decorative emoji from a category", () => {
    const entry = only(
      "### 📂 <a name=\"browser-automation\"></a>Browser Automation",
      "- [a/b](https://github.com/a/b) 🐍 - Desc.",
    );
    expect(entry.category).toBe("Browser Automation");
  });

  it("ignores non-GitHub bullets", () => {
    expect(parseReadme(md("- [x](https://example.com/x) 🐍 - No."))).toEqual([]);
  });

  it("ignores a GitHub link that names no repository", () => {
    // The entry pattern only guarantees a github.com URL, so a bare profile
    // link reaches parseRepoUrl and must be rejected there.
    expect(parseReadme(md("- [x](https://github.com/owner) 🐍 - Profile."))).toEqual(
      [],
    );
  });

  it("lowercases the id but preserves owner/repo casing", () => {
    const entry = only("- [A/B](https://github.com/MyOrg/MyRepo) 🐍 - Desc.");
    expect(entry.id).toBe("myorg/myrepo");
    expect(entry.owner).toBe("MyOrg");
    expect(entry.repo).toBe("MyRepo");
  });
});

// Each case below is a verbatim shape taken from the live README. They are the
// reason the marker scanner is separator-agnostic rather than a simple split.
describe("parseReadme markers (real-world edge cases)", () => {
  it("reads a conventional entry", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) 🎖️ 📇 ☁️ 🏠 🍎 🪟 🐧 - Desc.",
    );
    expect(entry.official).toBe(true);
    expect(entry.languages).toEqual(["typescript"]);
    expect(entry.scope).toEqual(["cloud", "local"]);
    expect(entry.os).toEqual(["macos", "windows", "linux"]);
  });

  it("accepts a bare 🎖 with no variation selector (line/line-bot-mcp-server)", () => {
    const entry = only("- [a/b](https://github.com/a/b) \u{1F396} 📇 ☁️ - Desc.");
    expect(entry.official).toBe(true);
    expect(entry.languages).toEqual(["typescript"]);
  });

  it("accepts a 🪟 with a variation selector (the 1-in-964 spelling)", () => {
    const entry = only("- [a/b](https://github.com/a/b) 📇 \u{1FA9F}\u{FE0F} - Desc.");
    expect(entry.os).toEqual(["windows"]);
  });

  it("treats slash-joined markers as both applying (lightpanda-io/gomcp)", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) 🏎 🏠/☁️ 🐧/🍎 - An MCP server in Go.",
    );
    expect(entry.languages).toEqual(["go"]);
    expect(entry.scope).toEqual(["local", "cloud"]);
    expect(entry.os).toEqual(["linux", "macos"]);
  });

  it("handles a leading dash and unspaced markers (hashicorp/terraform-mcp-server)", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) - 🎖️🏎️☁️ - The official Terraform MCP Server.",
    );
    expect(entry.official).toBe(true);
    expect(entry.languages).toEqual(["go"]);
    expect(entry.scope).toEqual(["cloud"]);
    expect(entry.description).toBe("The official Terraform MCP Server.");
  });

  it("skips an emoji that is not in the legend (johnneerdael/netskope-mcp)", () => {
    const entry = only("- [a/b](https://github.com/a/b) 🔒 ☁️ - An MCP to give access.");
    expect(entry.scope).toEqual(["cloud"]);
    expect(entry.description).toBe("An MCP to give access.");
  });

  it("accepts a C# marker missing its keycap (anythink-cloud/anythink-cli)", () => {
    const entry = only("- [a/b](https://github.com/a/b) #\u{FE0F} ☁️ 🍎 - Build and run.");
    expect(entry.languages).toEqual(["csharp"]);
    expect(entry.scope).toEqual(["cloud"]);
  });

  it("accepts a well-formed C# keycap", () => {
    const entry = only("- [a/b](https://github.com/a/b) #️⃣ 🏠 - Desc.");
    expect(entry.languages).toEqual(["csharp"]);
  });

  it("stops at prose when there is no separator at all", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) 📇 ☁️ MCP server to interact with Quran.com.",
    );
    expect(entry.languages).toEqual(["typescript"]);
    expect(entry.description).toBe("MCP server to interact with Quran.com.");
  });

  it("handles an en-dash separator", () => {
    const entry = only("- [a/b](https://github.com/a/b) 📇 🏠 – A Node.js MCP server.");
    expect(entry.scope).toEqual(["local"]);
    expect(entry.description).toBe("A Node.js MCP server.");
  });

  it("does not read markers out of the description", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) 📇 - A server for 🐍 Python and ☁️ clouds.",
    );
    expect(entry.languages).toEqual(["typescript"]);
    expect(entry.scope).toEqual([]);
  });

  it("deduplicates a repeated marker", () => {
    const entry = only("- [a/b](https://github.com/a/b) 📇 📇 🏠 🏠 - Desc.");
    expect(entry.languages).toEqual(["typescript"]);
    expect(entry.scope).toEqual(["local"]);
  });

  it("records an entry with no markers at all", () => {
    const entry = only("- [a/b](https://github.com/a/b) - Just a description.");
    expect(entry.official).toBe(false);
    expect(entry.languages).toEqual([]);
    expect(entry.scope).toEqual([]);
    expect(entry.os).toEqual([]);
  });
});

// Modelled on modelcontextprotocol/servers-archived: one monorepo listed 9
// times across 8 categories, with rows disagreeing about language because each
// row describes a different sub-server.
describe("mergeEntries", () => {
  it("unions categories, languages, scope and os across rows", () => {
    const rows = parseReadme(
      md(
        "### <a name=\"db\"></a>Databases",
        "- [m/mono](https://github.com/m/mono) 📇 🏠 🍎 - A TS database server.",
        "### <a name=\"vc\"></a>Version Control",
        "- [m/mono](https://github.com/m/mono) 🐍 ☁️ 🐧 - A Python git server.",
      ),
    );
    expect(rows).toHaveLength(2);

    const merged = mergeEntries(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.categories).toEqual(["Databases", "Version Control"]);
    expect(merged[0]!.languages).toEqual(["typescript", "python"]);
    expect(merged[0]!.scope).toEqual(["local", "cloud"]);
    expect(merged[0]!.os).toEqual(["macos", "linux"]);
  });

  it("keeps the first description and takes the first badge available", () => {
    const merged = mergeEntries(
      parseReadme(
        md(
          "### <a name=\"a\"></a>Alpha",
          "- [m/mono](https://github.com/m/mono) 📇 - First description.",
          "### <a name=\"b\"></a>Beta",
          "- [m/mono](https://github.com/m/mono) [![x](https://glama.ai/mcp/servers/m/mono/badges/score.svg)](https://glama.ai/mcp/servers/m/mono) 📇 - Second description.",
        ),
      ),
    );
    expect(merged[0]!.description).toBe("First description.");
    expect(merged[0]!.badgeUrl).toBe("https://glama.ai/mcp/servers/m/mono");
  });

  it("marks the repo official when any row is official", () => {
    const merged = mergeEntries(
      parseReadme(
        md(
          "### <a name=\"a\"></a>Alpha",
          "- [m/mono](https://github.com/m/mono) 📇 - Plain.",
          "### <a name=\"b\"></a>Beta",
          "- [m/mono](https://github.com/m/mono) 🎖️ 📇 - Official.",
        ),
      ),
    );
    expect(merged[0]!.official).toBe(true);
  });

  it("fills an empty description from a later row", () => {
    const merged = mergeEntries(
      parseReadme(
        md(
          "### <a name=\"a\"></a>Alpha",
          "- [m/mono](https://github.com/m/mono) 📇",
          "### <a name=\"b\"></a>Beta",
          "- [m/mono](https://github.com/m/mono) 📇 - Real description.",
        ),
      ),
    );
    expect(merged[0]!.description).toBe("Real description.");
  });

  it("leaves distinct repos alone", () => {
    const merged = mergeEntries(
      parseReadme(
        md(
          "### <a name=\"a\"></a>Alpha",
          "- [a/one](https://github.com/a/one) 📇 - One.",
          "- [b/two](https://github.com/b/two) 🐍 - Two.",
        ),
      ),
    );
    expect(merged.map((entry) => entry.id)).toEqual(["a/one", "b/two"]);
    expect(merged[0]!.categories).toEqual(["Alpha"]);
  });

  it("returns nothing for no rows", () => {
    expect(mergeEntries([])).toEqual([]);
  });
});

describe("parseReadme descriptions and badges", () => {
  it("keeps the anchor text of a link inside a description", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) 🐍 - mcp server for [cert-manager](https://github.com/cert-manager/cert-manager) management.",
    );
    expect(entry.description).toBe("mcp server for cert-manager management.");
  });

  it("extracts a Glama badge url", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) [![a/b MCP server](https://glama.ai/mcp/servers/a/b/badges/score.svg)](https://glama.ai/mcp/servers/a/b) 📇 - Desc.",
    );
    expect(entry.badgeUrl).toBe("https://glama.ai/mcp/servers/a/b");
    expect(entry.languages).toEqual(["typescript"]);
  });

  it("normalises the @owner badge url spelling", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) [![x](https://glama.ai/mcp/servers/@a/b/badges/score.svg)](https://glama.ai/mcp/servers/@a/b) 🐍 - Desc.",
    );
    expect(entry.badgeUrl).toBe("https://glama.ai/mcp/servers/a/b");
  });

  it("ignores a non-Glama badge", () => {
    const entry = only(
      "- [a/b](https://github.com/a/b) [![ci](https://img.shields.io/x.svg)](https://ci.example.com) 🐍 - Desc.",
    );
    expect(entry.badgeUrl).toBeNull();
  });

  it("has no badge when none is present", () => {
    expect(only("- [a/b](https://github.com/a/b) 🐍 - Desc.").badgeUrl).toBeNull();
  });
});
