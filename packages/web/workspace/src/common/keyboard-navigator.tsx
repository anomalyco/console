import { createEventListener } from "@solid-primitives/event-listener";
import { createContext, useContext } from "solid-js";

interface Props {
  target: string;
  onSelect: (input: HTMLElement) => void;
  onPeek?: (input: HTMLElement, event: "open" | "close") => void;
}

export function createKeyboardNavigator(props: Props) {
  const targets = () =>
    Array.from(document.querySelectorAll<HTMLElement>(props.target));
  const focused = () => targets().find((x) => x.dataset.focus === "true");

  function move(offset: -1 | 1) {
    const all = targets();
    if (all.length === 0) return;
    const focusedIndex = all.findIndex((x) => x.dataset.focus === "true");
    const f = all[focusedIndex];
    if (!f) {
      if (offset === 1) all.at(0)?.setAttribute("data-focus", "true");
      if (offset === -1) all.at(-1)?.setAttribute("data-focus", "true");
      return;
    }

    const next = all[focusedIndex + offset];
    if (!next) return;
    f.removeAttribute("data-focus");
    next.setAttribute("data-focus", "true");
    if (focusedIndex + offset === 0) {
      next.scrollIntoView({
        block: "end",
      });
      return;
    }
    next.scrollIntoView({
      block: "nearest",
    });
  }

  createEventListener(window, "keydown", (e) => {
    if (document.activeElement?.tagName === "TEXTAREA") return;
    if (
      document.activeElement?.tagName === "INPUT" &&
      (document.activeElement as HTMLInputElement).type === "text"
    )
      return;
    if (e.key === "j") move(1);
    if (e.key === "k") move(-1);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    }
    if (e.key === "Enter") {
      const f = focused();
      if (!f) return;
      props.onSelect(f);
    }

    if (e.key === " ") {
      e.preventDefault();
      const el = focused();
      if (!el) return;
      props.onPeek?.(el, "open");
    }
  });

  createEventListener(window, "keyup", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      const el = focused();
      if (!el) return;
      props.onPeek?.(el, "close");
    }
  });

  return {
    focus(target: HTMLElement) {
      const all = targets();
      const match = all.find(
        (item) => item === target || item.contains(target)
      );
      if (!match) return;
      const f = focused();
      if (f === match) return;
      if (f) f.removeAttribute("data-focus");
      match.setAttribute("data-focus", "true");
    },
    get focused() {
      return focused();
    },
  };
}

const KeyboardNavigatorContext =
  createContext<ReturnType<typeof createKeyboardNavigator>>();

export const KeyboardNavigator = KeyboardNavigatorContext.Provider;

export function useKeyboardNavigator() {
  const ctx = useContext(KeyboardNavigatorContext);
  return ctx;
}
