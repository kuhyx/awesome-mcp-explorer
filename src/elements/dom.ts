/**
 * DOM lookups shared by the explorer's modules.
 */

/**
 * The first match, or a thrown error naming the missing hook: markup that
 * lost a `data-*` attribute should fail loudly, not leave a dead control.
 */
export function required(root: ParentNode, selector: string): HTMLElement {
  return requiredAs(root, selector, HTMLElement);
}

/**
 * As {@link required}, narrowed to a concrete element class and checked at runtime.
 */
export function requiredAs<T extends Element>(
  root: ParentNode,
  selector: string,
  kind: abstract new () => T,
): T {
  const found = root.querySelector(selector);
  if (!(found instanceof kind)) {
    throw new TypeError(`<server-explorer> markup is missing ${selector}`);
  }
  return found;
}

/**
 * Sets an attribute, or removes it for `null` (a range-slider then falls back
 * to the distribution's own bound).
 */
export function setNumberAttribute(
  element: Element,
  name: string,
  value: null | number,
): void {
  if (value === null) {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, String(value));
}
