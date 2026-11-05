import type { Plugin } from "vitest/config";

import { defineConfig } from "astro/config";
import { realpathSync } from "node:fs";
import path from "node:path";

import { BASE_URL } from "./scripts/lib/site/site-config.ts";

// The AgentReady gate builds a temp copy whose node_modules is a symlink, so
// Vite realpaths a dependency's .astro file out of the project root. Astro
// keys compile metadata by root-relative path and then misses the file's
// `?astro&type=script` module. Map such ids back under <root>/node_modules.
const keepAstroDependenciesInRoot: Plugin = {
  enforce: "pre",
  name: "keep-astro-deps-in-root",
  resolveId: {
    filter: { id: /\.astro(?:\?|$)/ },
    async handler(id, importer, options) {
      const inRoot = path.join(this.environment.config.root, "node_modules");
      const real = realpathSync(inRoot);
      const hit = await this.resolve(id, importer, { ...options, skipSelf: true });
      const isOutside = hit !== null && real !== inRoot && hit.id.startsWith(`${real}/`);
      return isOutside ? { ...hit, id: inRoot + hit.id.slice(real.length) } : null;
    },
  },
};

// Static output, one directory per route (`about/index.html`), so the host
// needs no rewrite rules. `site` comes from the one place the public address
// lives, so canonical URLs and the sitemap never drift from it.
export default defineConfig({
  build: { format: "directory" },
  output: "static",
  site: BASE_URL,
  trailingSlash: "ignore",
  vite: { plugins: [keepAstroDependenciesInRoot] },
});
