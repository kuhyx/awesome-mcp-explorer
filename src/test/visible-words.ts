/**
 * The textgate guard: lists every word a sighted user would see on the page
 * that is not content. kuhy's rule is that the UI carries no text he did not
 * ask for; a word here is chrome that slipped back in.
 *
 * Works on any DOM (jsdom globals in the app project, a `new JSDOM()` in the
 * pipeline project), so it only touches the root's own document.
 */

/**
 * Text the page displays but did not write: data from servers.json, names the
 * user typed, and the facet option values that are proper nouns.
 */
const CONTENT_SELECTORS = [
  ".row-name",
  ".row-desc",
  ".chip-cat",
  ".chip-lang",
  ".chip-scope",
  ".row-spdx",
  '[data-facet="categories"] .tri-name',
  "[data-saved] [data-preset]",
];

/**
 * In the DOM but never painted. `.slider-head > span:first-child` is the
 * caption @kuhyx/web-ui's range slider prints; CSS hides it (jsdom has no CSS).
 */
const HIDDEN_SELECTORS = [".sr-only", "script", "style", "template", ".slider-head > span:first-child"];

/**
 * Proper nouns and symbols kept on purpose (see ~/data/awesome-mcp-explorer_notext/keep.md).
 */
const ALLOWED_WORDS = new Set(
  [
    // Language, scope and OS option names.
    "TS", "JS", "Python", "Go", "Java", "Ruby", "Rust",
    "local", "cloud", "embedded", "macos", "windows", "linux",
    // Licence name, export formats, the grade mark and a key cap.
    "FOSS", "JSON", "CSV", "Markdown", "AAA", "Esc",
  ].map((word) => word.toLowerCase()),
);

// A number with its unit symbol: 1.7k stars, 3d / 3mo / 2y since the last push.
const UNIT_TOKEN = /\b\d[\d.]{0,5}(?:k|d|mo|y)\b/gu;
const WORD = /\p{L}{2,}/gu;
const SHOW_TEXT = 4;

export interface WordReport {
  /**
   * Text nodes looked at, so an empty or broken page cannot pass by having nothing to check.
   */
  readonly inspected: number;
  readonly words: readonly string[];
}

function strayIn(text: string): string[] {
  return (text.replaceAll(UNIT_TOKEN, " ").match(WORD) ?? []).filter(
    (word) => !ALLOWED_WORDS.has(word.toLowerCase()),
  );
}

export function visibleWords(root: Element): WordReport {
  const copy = root.cloneNode(true) as Element;
  const removable = copy.querySelectorAll([...HIDDEN_SELECTORS, ...CONTENT_SELECTORS].join(", "));
  for (const node of removable) node.remove();
  const painted = copy.querySelectorAll("[title], [placeholder]");
  const words: string[] = Array.from(painted, (node) => `title/placeholder on <${node.localName}>`);
  const walker = copy.ownerDocument.createTreeWalker(copy, SHOW_TEXT);
  let inspected = 0;
  while (walker.nextNode() !== null) {
    inspected += 1;
    words.push(...strayIn(walker.currentNode.textContent ?? ""));
  }
  return { inspected, words };
}
