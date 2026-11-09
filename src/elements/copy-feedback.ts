/**
 * Copy-link feedback without a word: the link icon swaps to a green check with
 * a short pulse (CSS keys off `data-copied`), then swaps back.
 */
export const COPIED_MS = 1500;

const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function flashCopied(button: HTMLElement, ms = COPIED_MS): void {
  clearTimeout(timers.get(button));
  button.dataset.copied = "";
  timers.set(
    button,
    setTimeout(() => {
      delete button.dataset.copied;
    }, ms),
  );
}
