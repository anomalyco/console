import {
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  onCleanup,
  ParentProps,
  useContext,
} from "solid-js";
import { styled } from "@macaron-css/solid";
import { theme } from "$/ui/theme";
import { filter, groupBy, pipe } from "remeda";
import { globalStyle } from "@macaron-css/core";
import { Portal } from "solid-js/web";
import {
  createEventListener,
  makeEventListener,
} from "@solid-primitives/event-listener";
import { createMutationObserver } from "@solid-primitives/mutation-observer";
import { utility } from "$/ui/utility";
import { IconSubRight } from "$/ui/icons/custom";
import { Navigator, useLocation } from "@solidjs/router";
import { Text } from "$/ui/text";
import { bus } from "$/providers/bus";

export interface Action {
  icon: (props: any) => JSX.Element;
  disabled?: boolean;
  title: string;
  category?: string;
  hotkeys?: string[];
  run: (control: Control) => void | Promise<void>;
}

type ActionProvider = (filter: string, global: boolean) => Promise<Action[]>;

export function NavigationAction(input: {
  path: string;
  prefix?: boolean;
  title: string;
  category: string;
  icon?: (props: any) => JSX.Element;
  disabled?: boolean;
  nav: Navigator;
}): Action {
  const loc = useLocation();
  return {
    icon: input.icon || IconSubRight,
    title: input.title,
    category: input.category,
    disabled: input.disabled ||
      (input.path.startsWith("/") &&
        (!input.prefix
          ? loc.pathname === input.path
          : loc.pathname.startsWith(input.path))) ||
      (input.path.startsWith("./") &&
        (!input.prefix
          ? loc.pathname.endsWith(input.path.substring(1))
          : loc.pathname.includes(input.path.substring(1)))),
    run: (control) => {
      control.hide();
      input.nav(input.path);
    },
  };
}

const Root = styled("div", {
  base: {
    position: "fixed",
    backgroundColor: theme.color.background.overlay,
    opacity: 0,
    inset: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "start",
    pointerEvents: "none",
    transition: "200ms opacity",
    paddingTop: "10vh",
    zIndex: 1,
  },
  variants: {
    show: {
      true: {
        opacity: 1,
        pointerEvents: "all",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      },
    },
  },
});

const Modal = styled("div", {
  base: {
    width: theme.modalWidth.md,
    borderRadius: 10,
    flexShrink: 0,
    boxShadow: theme.color.shadow.drop.long,
    background: theme.color.background.modal,
    // Safari doesn't redraw properly when the height
    // of the modal changes
    // Forcing a repaint: https://stackoverflow.com/a/21947628
    transform: "scale(0.95) translateZ(0)",
    transition: "200ms all",
  },
});

globalStyle(`${Root.selector({ show: true })} ${Modal}`, {
  transform: "scale(1) translateZ(0)",
});

const Filter = styled("div", {
  base: {
    padding: `${theme.space[4]} ${theme.space[5]}`,
    display: "flex",
  },
});

const FilterInput = styled("input", {
  base: {
    flexGrow: 1,
    border: 0,
    background: "transparent",
  },
});

const Results = styled("div", {
  base: {
    borderTop: `1px solid ${theme.color.divider.base}`,
    maxHeight: 320,
    padding: theme.space[2],
    overflowY: "auto",
    selectors: {
      "&::-webkit-scrollbar": {
        display: "none",
      },
      "&:empty": {
        display: "none",
      },
    },
  },
});

const Category = styled("div", {
  base: {
    display: "flex",
    padding: `${theme.space[2]} ${theme.space[3]}`,
    fontFamily: theme.font.family.heading,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: theme.font.size.sm,
    alignItems: "center",
    fontWeight: theme.textBoldWeight,
    color: theme.color.text.dimmed.base,
  },
});

const ActionRow = styled("div", {
  base: {
    ...utility.row(2),
    padding: `0 ${theme.space[3]}`,
    height: 48,
    alignItems: "center",
    borderRadius: theme.borderRadius,
    fontSize: theme.font.size.base,
  },
});

globalStyle(`${ActionRow}.active`, {
  background: theme.color.background.hover,
});

const ActionRowIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 15,
    height: 15,
  },
});

globalStyle(`${ActionRowIcon} svg`, {
  color: theme.color.icon.secondary,
  transition: `color ${theme.colorFadeDuration} ease-out`,
});

globalStyle(`${ActionRow}.active ${ActionRowIcon} svg`, {
  color: theme.color.icon.primary,
});

function createControl() {
  const providers = [] as { name: string; provider: ActionProvider }[];
  const [activeProviders, setActiveProviders] = createSignal<string[]>([]);
  const [visible, setVisible] = createSignal(false);
  const [actions, setActions] = createSignal<Action[]>([]);
  const [input, setInput] = createSignal("");
  const [root, setRoot] = createSignal<HTMLElement>();

  function show(...providers: string[]) {
    console.log("showing command bar");
    bus.emit("bar.show", true);
    batch(() => {
      setActiveProviders(providers);
      setVisible(true);
      setInput("");
    });
    control.input().focus();
    control.setActive(control.actions()[0]);
  }

  function hide() {
    control.input().blur();
    setVisible(false);
  }

  makeEventListener(document, "keydown", (e) => {
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      show();
    }

    if (!visible()) return;

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopImmediatePropagation();
      const current = control.active();
      if (current) current.click();
    }
  });

  createEffect(async () => {
    if (!visible()) return;
    const p = activeProviders().length
      ? activeProviders()
        .map((p) => providers.find((e) => e.name === p)!)
        .filter(Boolean)
      : [...providers.values()].reverse();
    const actions = await Promise.all(
      p.map(async (entry) => {
        const actions = await entry.provider(
          input(),
          activeProviders().length === 0,
        );
        return actions;
      }),
    ).then((x) => x.flat());
    setActions(actions);
  });

  const groups = createMemo(() => {
    return pipe(
      actions() || [],
      filter(
        (action) =>
          action.title.toLowerCase().includes(input().toLowerCase()) ||
          Boolean(
            action.category?.toLowerCase().includes(input().toLowerCase()),
          ),
      ),
      filter((action) => !action.disabled),
      groupBy((a) => a.category),
    );
  });

  createMutationObserver(
    () => root()?.querySelector(`[data-element="results"]`)!,
    { childList: true },
    () => control.reset(),
  );

  let isTyping = false;
  makeEventListener(document, "mousemove", () => {
    isTyping = false;
  });

  const control = {
    get root() {
      const r = root();
      if (!r) throw new Error("Root not set");
      return r;
    },
    input() {
      return control.root.querySelector("input") as HTMLInputElement;
    },
    actions() {
      return [...control.root.querySelectorAll("[data-element='action']")];
    },
    reset() {
      control.setActive(control.actions()[0]);
    },
    active() {
      return control.root.querySelector(
        "[data-element='action'].active",
      ) as HTMLElement;
    },
    setActive(el: Element, disableScroll?: boolean) {
      if (!el) return;
      const current = control.active();
      if (current) current.classList.remove("active");
      el.classList.add("active");
      if (!disableScroll) {
        const index = control.actions().indexOf(el);
        if (index === 0) {
          el.scrollIntoView({
            block: "end",
          });
          return;
        }

        el.scrollIntoView({
          block: "nearest",
        });
      }
    },
    move(direction: -1 | 1) {
      const current = control.active();
      const all = control.actions();
      if (!current) {
        control.setActive(all[0]);
        return;
      }
      const index = all.indexOf(current);
      const next = all[index + direction];
      control.setActive(next ?? all[direction == 1 ? 0 : all.length - 1]);
    },
    next() {
      return control.move(1);
    },
    back() {
      return control.move(-1);
    },
  };

  createEventListener(window, "keydown", (e) => {
    if (!visible()) return;
    if (e.key === "ArrowDown") {
      control.next();
      e.preventDefault();
    }

    if (e.key === "ArrowUp") {
      control.back();
      e.preventDefault();
    }

    if (e.key === "Escape") {
      setTimeout(() => hide(), 1);
    }
  });

  return {
    bind: setRoot,
    get input() {
      return input();
    },
    get isTyping() {
      return isTyping;
    },
    setInput(input: string) {
      isTyping = true;
      setInput(input);
    },
    setActive: control.setActive,
    get groups() {
      return groups();
    },
    get visible() {
      return visible();
    },
    register(name: string, provider: ActionProvider) {
      providers.push({ name, provider });
      console.log("setting", name);
      onCleanup(() => {
        providers.splice(
          providers.findIndex((e) => e.name === name),
          1,
        );
      });
    },
    show,
    hide,
  };
}

type Control = ReturnType<typeof createControl>;

export const CommandbarContext = createContext<Control>();

export function CommandBar(props: ParentProps) {
  createEventListener(document, "mouseup", (e) => {
    if (!modal?.contains(e.target as Node)) {
      if (control.visible) control.hide();
    }
  });

  const control = createControl();
  let scrolling: number | undefined;
  let modal!: HTMLDivElement;

  return (
    <CommandbarContext.Provider value={control}>
      {props.children}
      <Portal mount={document.getElementById("styled")!}>
        <Root show={control.visible} ref={control.bind}>
          <Modal ref={modal}>
            <Filter>
              <FilterInput
                value={control.input}
                onInput={(e) => control.setInput(e.target.value)}
                placeholder="Type to search"
              />
            </Filter>
            <Results
              data-element="results"
              onScroll={() => {
                if (scrolling) window.clearTimeout(scrolling);
                scrolling = window.setTimeout(() => {
                  scrolling = undefined;
                }, 100);
              }}
            >
              <For each={Object.entries(control.groups)}>
                {([category, actions]) => (
                  <>
                    <Category>{category}</Category>
                    <For each={actions}>
                      {(action) => (
                        <ActionRow
                          onMouseOver={(e) => {
                            const target = e.currentTarget;
                            if (control.isTyping) return;
                            setTimeout(() => {
                              if (scrolling) return;
                              control.setActive(target, true);
                            }, 0);
                          }}
                          data-element="action"
                          onClick={() => {
                            action.run(control);
                          }}
                        >
                          <ActionRowIcon>
                            <action.icon />
                          </ActionRowIcon>
                          <Text
                            line
                            on="surface"
                            color="primary"
                            leading="normal"
                          >
                            {action.title}
                          </Text>
                        </ActionRow>
                      )}
                    </For>
                  </>
                )}
              </For>
            </Results>
          </Modal>
        </Root>
      </Portal>
    </CommandbarContext.Provider>
  );
}

export function useCommandBar() {
  const ctx = useContext(CommandbarContext);
  if (!ctx) throw new Error("No commandbar context");
  return ctx;
}
