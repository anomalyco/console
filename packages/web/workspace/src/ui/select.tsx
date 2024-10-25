import * as Kobalte from "@kobalte/core/select";
import * as KSeperator from "@kobalte/core/separator";
import { style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { IconCheck, IconChevronDown } from "./icons";
import { utility } from "./utility";
import { theme } from "./theme";
import {
  Root,
  inputStyles,
  inputFocusStyles,
  inputDisabledStyles,
  inputDangerTextStyles,
  inputDangerFocusStyles,
} from "./form";
import {
  JSX,
  Show,
  splitProps,
  createEffect,
  createSignal,
  createComputed,
} from "solid-js";

const Trigger = styled(Kobalte.Trigger<"button">, {
  base: {
    ...utility.row(2),
    ...inputStyles,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    ":focus": {
      ...inputFocusStyles,
    },
    ":invalid": {
      color: theme.color.text.dimmed.base,
    },
    ":disabled": {
      ...inputDisabledStyles,
    },
    selectors: {
      [`${Root.selector({ color: "danger" })} &`]: {
        ...inputDangerFocusStyles,
      },
    },
  },
  variants: {
    size: {
      sm: {
        height: theme.input.size.sm,
      },
      base: {
        height: theme.input.size.base,
      },
    },
  },
  defaultVariants: {
    size: "base",
  },
});

const TriggerText = styled("span", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    [`${Root.selector({ color: "danger" })} &`]: {
      ...inputDangerTextStyles,
    },
  },
  variants: {
    size: {
      sm: {
        fontSize: theme.font.size.xs,
      },
      base: {
        fontSize: theme.font.size.sm,
      },
    },
  },
  defaultVariants: {
    size: "base",
  },
});

const DownIcon = styled(Kobalte.Icon<"span">, {
  base: {
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: theme.iconOpacity,
    color: theme.color.icon.primary,
    flexShrink: 0,
    selectors: {
      "&[data-expanded]": {
        transform: "rotate(180deg)",
      },
    },
  },
});

const Content = styled(Kobalte.Content<"div">, {
  base: {
    marginTop: 0,
    zIndex: 1,
    padding: `${theme.space[1]} 0`,
    border: `1px solid ${theme.color.divider.base}`,
    borderRadius: theme.borderRadius,
    background: theme.color.background.popup,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: theme.color.shadow.drop.medium,
    width: 220,
  },
});

const listbox = style({
  overflowY: "auto",
  maxHeight: 360,
});

const Item = styled(Kobalte.Item<"li">, {
  base: {
    ...utility.row(2),
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${theme.space[2.5]} ${theme.space[3]}`,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    color: theme.color.text.secondary.base,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    userSelect: "none",
    outline: "none",
    selectors: {
      "&[data-highlighted]": {
        color: theme.color.text.primary.surface,
        backgroundColor: theme.color.background.hover,
      },
      "&[data-disabled]": {
        color: theme.color.text.dimmed.surface,
        pointerEvents: "none",
      },
    },
  },
});

const ItemLabel = styled("span", {
  base: {
    ...utility.text.line,
  },
});

const ItemIndicator = styled(Kobalte.ItemIndicator<"div">, {
  base: {
    opacity: theme.iconOpacity,
    display: "flex",
    alignItems: "center",
  },
});

const Seperator = styled(KSeperator.Root<"hr">, {
  base: {
    height: 1,
    margin: `${theme.space[1]} 0`,
    backgroundColor: theme.color.divider.surface,
    border: 0,
  },
});

// @ts-expect-error
const Listbox = styled(Kobalte.Listbox, {
  base: {
    selectors: {
      "&::-webkit-scrollbar": {
        width: 0,
        background: "transparent",
      },
    },
  },
});

type Option = {
  label?: string;
  value: string;
  seperator?: boolean;
};
type SelectProps = {
  size?: "sm" | "base";
  triggerClass?: string;
  name?: string;
  placeholder?: string;
  options: Option[];
  error?: string;
  required?: boolean | undefined;
  disabled?: boolean;
  ref?: (element: HTMLSelectElement) => void;
  onInput?: JSX.EventHandler<HTMLSelectElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLSelectElement, Event>;
  onBlur?: JSX.EventHandler<HTMLSelectElement, FocusEvent>;
};

type SingleSelect = {
  value?: string;
} & SelectProps;

export function Select(props: SingleSelect) {
  const [rootProps, selectProps] = splitProps(
    props,
    ["name", "placeholder", "options", "required", "disabled"],
    ["placeholder", "ref", "onInput", "onChange", "onBlur"],
  );
  const [getValue, setValue] = createSignal<Option>();
  createEffect(() => {
    setValue(props.options.find((option) => props.value === option.value));
  });
  return (
    <Kobalte.Root<Option>
      {...rootProps}
      multiple={false}
      value={getValue()}
      onChange={setValue}
      validationState={props.error ? "invalid" : "valid"}
      optionValue="value"
      optionTextValue="label"
      itemComponent={(props) => (
        <>
          <Item item={props.item}>
            <ItemLabel>{props.item.textValue}</ItemLabel>
            <ItemIndicator>
              <IconCheck width={14} height={14} />
            </ItemIndicator>
          </Item>
          <Show when={props.item.rawValue.seperator}>
            <Seperator />
          </Show>
        </>
      )}
    >
      <Kobalte.HiddenSelect {...selectProps} />
      <Trigger
        size={props.size}
        disabled={props.disabled}
        class={props.triggerClass}
      >
        <TriggerText size={props.size}>
          <Kobalte.Value<Option>>
            {(state) => state.selectedOption()?.label}
          </Kobalte.Value>
        </TriggerText>
        <DownIcon>
          <IconChevronDown width={15} height={15} />
        </DownIcon>
      </Trigger>
      <Kobalte.Portal mount={document.getElementById("styled")!}>
        <Content>
          <Listbox class={listbox} />
        </Content>
      </Kobalte.Portal>
    </Kobalte.Root>
  );
}

type MultiSelectProps = {
  value?: string[];
} & SelectProps;
export function MultiSelect(props: MultiSelectProps) {
  const [rootProps, selectProps] = splitProps(
    props,
    ["name", "placeholder", "options", "required", "disabled"],
    ["placeholder", "ref", "onInput", "onChange", "onBlur"],
  );
  const [getValue, setValue] = createSignal<Option[]>();
  createComputed(() => {
    if (!props.value) {
      setValue([]);
      return;
    }
    const next = props.value
      ?.map((item) => props.options.find((option) => item === option.value)!)
      .filter(Boolean);
    setValue(next);
  });
  return (
    <Kobalte.Root<Option>
      {...rootProps}
      multiple={true}
      value={getValue()}
      onChange={setValue}
      optionValue="value"
      optionTextValue="label"
      validationState={props.error ? "invalid" : "valid"}
      itemComponent={(props) => (
        <>
          <Item item={props.item}>
            <ItemLabel>{props.item.textValue}</ItemLabel>
            <ItemIndicator>
              <IconCheck width={14} height={14} />
            </ItemIndicator>
          </Item>
          <Show when={props.item.rawValue.seperator}>
            <Seperator />
          </Show>
        </>
      )}
    >
      <Kobalte.HiddenSelect {...selectProps} />
      <Trigger size={props.size} disabled={props.disabled}>
        <TriggerText size={props.size}>
          <Kobalte.Value<Option>>
            {(state) =>
              state.selectedOptions().length > 1
                ? state.selectedOptions().length + " selected"
                : state.selectedOption()?.label
            }
          </Kobalte.Value>
        </TriggerText>
        <DownIcon>
          <IconChevronDown width={15} height={15} />
        </DownIcon>
      </Trigger>
      <Kobalte.Portal mount={document.getElementById("styled")!}>
        <Content>
          <Listbox class={listbox} />
        </Content>
      </Kobalte.Portal>
    </Kobalte.Root>
  );
}
