import * as Kobalte from "@kobalte/core/dropdown-menu";
import { styled } from "@macaron-css/solid";
import { IconChevronDown } from "./icons";
import { Text } from "./text";
import { utility } from "./utility";
import { theme } from "./theme";
import { inputStyles, inputFocusStyles, inputDisabledStyles } from "./form";
import { JSX, Show, ComponentProps } from "solid-js";

const Trigger = styled(Kobalte.Trigger<"button">, {
  base: {
    ...utility.row(2),
    ...inputStyles,
    maxWidth: 200,
    alignItems: "center",
    color: theme.color.icon.secondary,
    justifyContent: "space-between",
    ":focus": {
      ...inputFocusStyles,
    },
    ":invalid": {
      color: theme.color.text.dimmed.base,
    },
    ":disabled": {
      ...inputDisabledStyles,
      boxShadow: "none",
    },
    selectors: {
      "&:hover:not([disabled])": {
        color: theme.color.icon.primary,
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
    icon: {
      true: {
        padding: 0,
        boxShadow: "none",
        appearance: "none",
        background: "none",
        ":disabled": {
          backgroundColor: "transparent",
        },
      },
      false: {},
    },
    disabled: {
      true: {
        ...inputDisabledStyles,
      },
      false: {},
    },
  },
  defaultVariants: {
    size: "base",
    icon: false,
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

const TriggerIcon = styled("span", {
  base: {
    display: "flex",
    transition: `color ${theme.colorFadeDuration} ease-out`,
  },
});

const Content = styled(Kobalte.Content<"div">, {
  base: {
    marginTop: theme.space[1],
    padding: `${theme.space[1]} 0`,
    border: `1px solid ${theme.color.divider.base}`,
    borderRadius: theme.borderRadius,
    background: theme.color.background.popup,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: theme.color.shadow.drop.medium,
    zIndex: 10,
    width: 220,
  },
});

const Item = styled(Kobalte.Item<"div">, {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    padding: `${theme.space[2.5]} ${theme.space[3]}`,
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      "&[data-highlighted]": {
        color: theme.color.text.primary.surface,
        backgroundColor: theme.color.background.hover,
      },
    },
  },
});

const RadioGroup = styled(Kobalte.RadioGroup<"div">, {});

const RadioItem = styled(Kobalte.RadioItem<"div">, {
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
    WebkitUserSelect: "none",
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

const RadioItemLabel = styled("span", {
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

const Seperator = styled(Kobalte.Separator<"hr">, {
  base: {
    height: 1,
    margin: `${theme.space[1]} 0`,
    backgroundColor: theme.color.divider.surface,
    border: 0,
  },
});

type Props = ComponentProps<typeof Kobalte.Root> & {
  icon?: JSX.Element;
  size?: "sm" | "base";
  label?: string;
  disabled?: boolean;
  triggerClass?: string;
};

export function Dropdown(props: Props) {
  return (
    <Kobalte.Root {...props}>
      <Trigger
        size={props.size}
        disabled={props.disabled}
        class={props.triggerClass}
        icon={props.icon !== undefined}
      >
        <Show
          when={props.icon}
          fallback={
            <>
              <Text
                line
                leading="normal"
                color="secondary"
                size={props.size === "sm" ? "xs" : "sm"}
              >
                {props.label}
              </Text>
              <DownIcon>
                <IconChevronDown width={15} height={15} />
              </DownIcon>
            </>
          }
        >
          <TriggerIcon>{props.icon}</TriggerIcon>
        </Show>
      </Trigger>
      <Kobalte.Portal mount={document.getElementById("styled")!}>
        <Content>{props.children}</Content>
      </Kobalte.Portal>
    </Kobalte.Root>
  );
}

Dropdown.Item = Item;
Dropdown.RadioItem = RadioItem;
Dropdown.Seperator = Seperator;
Dropdown.RadioGroup = RadioGroup;
Dropdown.ItemIndicator = ItemIndicator;
Dropdown.RadioItemLabel = RadioItemLabel;
