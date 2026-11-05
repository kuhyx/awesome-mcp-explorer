/**
 * Parses trusted test markup into a fragment, for `replaceChildren`.
 */
export function fragmentOf(html: string): DocumentFragment {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const fragment = document.createDocumentFragment();
  fragment.append(...document.importNode(parsed.body, true).childNodes);
  return fragment;
}
