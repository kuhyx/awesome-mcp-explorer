/**
 * Global keyboard shortcuts.
 *
 * Kept as a pure handler plus a thin effect so the key mapping is testable
 * without mounting anything.
 */
import { useEffect } from "react";

export interface KeyboardActions {
  readonly onClear: () => void;
  readonly onFocusSearch: () => void;
  readonly onToggleHelp: () => void;
  readonly onToggleTripleA: () => void;
}

/** True when the event target is a field that should swallow the keystroke. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
  );
}

/**
 * Maps a keydown to an action, or null if it should pass through.
 *
 * Escape works while typing (it is how you leave the field); everything else is
 * suppressed inside inputs, so typing "a" in the search box cannot toggle a
 * filter out from under you.
 */
export function actionFor(
  event: Pick<KeyboardEvent, "ctrlKey" | "key" | "metaKey" | "target">,
): keyof KeyboardActions | null {
  if (event.ctrlKey || event.metaKey) return null;
  if (event.key === "Escape") return "onClear";
  if (isTypingTarget(event.target)) return null;

  switch (event.key) {
    case "/": {
      return "onFocusSearch";
    }
    case "?": {
      return "onToggleHelp";
    }
    case "a": {
      return "onToggleTripleA";
    }
    default: {
      return null;
    }
  }
}

export function useKeyboard(actions: KeyboardActions): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const action = actionFor(event);
      if (action === null) return;
      event.preventDefault();
      actions[action]();
    }

    globalThis.addEventListener("keydown", onKeyDown);
    return (): void => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [actions]);
}
