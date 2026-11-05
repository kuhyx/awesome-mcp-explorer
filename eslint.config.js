// Maximally aggressive, type-aware flat config.
//
// Baseline is typescript-eslint's *type-checked* strict + stylistic presets, so
// anything they flag is an error, not a warning. On top of that: unicorn (all),
// sonarjs (cognitive complexity / duplicate logic), perfectionist (sorting), and
// astro. Unused disable directives are themselves errors, so every
// `eslint-disable` in this repo must be load-bearing.
//
// TypeScript is pinned to 6.0.x, not 7.x: typescript-eslint requires
// "typescript >=4.8.4 <6.1.0", and losing every type-aware rule would be a far
// bigger regression than gaining the Go-native compiler.
import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import perfectionist from "eslint-plugin-perfectionist";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

const config = tseslint.config(
  { ignores: ["dist", "coverage", ".astro", "data/cache", "public/servers.json"] },
  { linterOptions: { reportUnusedDisableDirectives: "error" } },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  unicorn.configs.all,
  sonarjs.configs.recommended,
  perfectionist.configs["recommended-natural"],
  ...astro.configs["flat/recommended"],

  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Numbers in template literals are unambiguous and pervasive here
      // (counts, star totals, grades).
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],

      // Keep the rule, widen its vocabulary. `passesFilters(server, filter)`
      // and `matchesQuery(...)` are predicates that read as English; forcing
      // them to `isPassingFilters` would be worse prose in service of a prefix
      // list. `passes`/`matches` are added, nothing is removed.
      "unicorn/consistent-boolean-name": [
        "error",
        { prefixes: { matches: true, passes: true } },
      ],

      // Kebab-case file names: house convention, .astro included.
      "unicorn/filename-case": ["error", { case: "kebabCase" }],

    },
  },

  // House overrides, applied to every file including this config itself.
  //
  // Each rule below is switched off deliberately: these are the cases where
  // "more aggressive" makes the code worse rather than safer. A rule you must
  // disable at every use site is worse than no rule at all, because
  // reportUnusedDisableDirectives then turns the disables into their own debt.
  {
    rules: {
      // Directly contradicts unicorn/consistent-class-member-order: one wants
      // a private field before the getter that reads it, the other wants the
      // getter first, and satisfying either re-triggers the other. unicorn's
      // wins because "declare the field before the code that uses it" is a
      // reason, whereas alphabetical order within a class is not.
      "perfectionist/sort-classes": "off",

      // Sorts Map entries by key. The marker table in parse-readme.ts is keyed
      // by emoji codepoint, so "sorted" would mean ordered by
      // U+1F396 < U+1F3CE < ... — meaningless to a reader, and it would shred
      // the legend's own grouping (official, languages, scope, OS) into noise.
      "perfectionist/sort-maps": "off",

      // Alphabetises declarations within a file, which actively fights reading
      // order: it would scatter `GRADES -> gradeRank -> isTripleA` into
      // `compositeRank -> GRADES -> gradeCoverage`. Alphabetical order is not
      // narrative order. Every *other* perfectionist rule stays on — sorting
      // imports, union members and object keys destroys no narrative.
      "perfectionist/sort-modules": "off",

      // `Props` is the name Astro requires for a component's props interface.
      "unicorn/name-replacements": ["error", { replacements: { props: false } }],

      // Wants JSDoc blocks written without leading `*`, which is neither the
      // TypeScript convention nor what editors/typedoc render.
      "unicorn/no-asterisk-prefix-in-documentation-comments": "off",

      // Flags hand-wrapped comment prose. Comments here are wrapped to 80
      // columns on purpose; the rule would force one long line per paragraph.
      "unicorn/no-manually-wrapped-comments": "off",

      // `null` is load-bearing here and cannot be replaced by `undefined`:
      //   1. The pipeline's output is JSON, and JSON has no `undefined`. A
      //      `glama: null` field is unavoidable in servers.json.
      //   2. The two values mean different things in this domain — `null` is
      //      "Glama never indexed this server", `undefined` is "indexed, but
      //      this axis was not graded". Collapsing them would lose information
      //      the UI displays differently (not-indexed vs graded-partial).
      "unicorn/no-null": "off",

      // `Temporal` does not exist in this project's runtime: Node 26 reports
      // `typeof Temporal === "undefined"`. The rule is unfollowable until it
      // ships. The inputs here are GitHub's ISO-8601 timestamps, which
      // Date.parse handles identically across engines — the cross-engine
      // inconsistency the rule warns about is for non-ISO strings.
      "unicorn/prefer-temporal": "off",

      // The domain vocabulary is abbreviated on purpose: `os`, `spdx`, `repo`,
      // `env` are the names the source data uses, and expanding them to
      // `operatingSystem` / `repository` would obscure the mapping.
      "unicorn/prevent-abbreviations": "off",
    },
  },

  {
    rules: {
      // Caps a try block at ONE statement. Unfollowable where the whole point
      // is that several steps can throw: loadPresets must wrap getItem (throws
      // in private browsing), JSON.parse (throws on junk) and the shape check
      // together, because any of them failing means the same thing — fall back
      // to no presets. Splitting them into three try blocks would be strictly
      // worse code. The rule has no maximum option, so it is all or nothing.
      "unicorn/try-complexity": "off",
    },
  },

  {
    files: ["astro.config.ts"],
    rules: {
      // Vite plugin hooks get their context (`this.resolve`) as `this`.
      "unicorn/no-this-outside-of-class": "off",
    },
  },

  // Tests: relax the rules that fight with mocking and fixtures.
  {
    files: ["**/*.test.ts", "src/test/**", "scripts/**/__fixtures__/**"],
    rules: {
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
      "sonarjs/no-duplicate-string": "off",
      // Test helpers live beside the tests that use them; hoisting every
      // fixture factory to module scope to satisfy a scoping rule would
      // scatter each test's setup away from the test.
      "unicorn/consistent-function-scoping": "off",
      // A no-op stub is the point of a stub.
      "unicorn/no-empty-file": "off",
    },
  },

  // The vitest setup file exists *to* perform top-level side effects: it patches
  // globals (ResizeObserver, layout metrics, pointer capture) that jsdom lacks,
  // before any test imports run. These two rules cannot be satisfied by a file
  // whose entire contract is "mutate the environment on import".
  {
    files: ["src/test/setup.ts"],
    rules: {
      // The stubs are property getters installed on DOM prototypes, so `this`
      // is the element being measured — there is no class to put them in.
      "unicorn/no-this-outside-of-class": "off",
      "unicorn/no-top-level-assignment-in-function": "off",
      "unicorn/no-top-level-side-effects": "off",
    },
  },

  // Plain JS config files and .astro templates get no type-aware linting; the
  // logic .astro files call lives in type-checked .ts modules.
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: ["**/*.{js,mjs,cjs}", "**/*.astro", "**/*.astro/*.ts"],
  },
);

export default config;
