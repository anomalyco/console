import * as Kobalte from "@kobalte/core/switch";
import { style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { Show, ComponentProps } from "solid-js";
import { theme } from "./theme";

const Root = styled(Kobalte.Root<"div">, {
  base: {
    display: "inline-flex",
    alignItems: "center",
  },
});

const control = style({
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  border: `1px solid ${theme.color.switch.base.border}`,
  backgroundColor: theme.color.switch.base.background,
  transition: "250ms background-color",
  selectors: {
    "&[data-checked]": {
      borderColor: theme.color.switch.selected.border,
      backgroundColor: theme.color.switch.selected.background,
    },
    "&[data-size='base']": {
      padding: `0 ${theme.switch.padding.base}`,
      height: theme.switch.size.base,
      width: `calc(((${theme.switch.size.base} - ${theme.switch.padding.base}) * 2) + 2px)`,
      borderRadius: `calc(${theme.switch.size.base} / 2)`,
    },
    "&[data-size='sm']": {
      padding: `0 ${theme.switch.padding.sm}`,
      height: theme.switch.size.sm,
      width: `calc(((${theme.switch.size.sm} - ${theme.switch.padding.sm}) * 2) + 2px)`,
      borderRadius: `calc(${theme.switch.size.sm} / 2)`,
    },
  },
});

const Thumb = styled(Kobalte.Thumb<"div">, {
  base: {
    backgroundColor: theme.color.background.base,
    transition: "250ms transform",
    selectors: {
      "&[data-checked]": {
        transform: "translateX(calc(100%))",
      },
      [`${control}[data-size="base"] &`]: {
        width: `calc(${theme.switch.size.base} - (2 * ${theme.switch.padding.base}))`,
        height: `calc(${theme.switch.size.base} - (2 * ${theme.switch.padding.base}))`,
        borderRadius: `calc(
          (${theme.switch.size.base} - (2 * ${theme.switch.padding.base})) / 2
        )`,
      },
      [`${control}[data-size="sm"] &`]: {
        width: `calc(${theme.switch.size.sm} - (2 * ${theme.switch.padding.sm}))`,
        height: `calc(${theme.switch.size.sm} - (2 * ${theme.switch.padding.sm}))`,
        borderRadius: `calc(
          (${theme.switch.size.sm} - (2 * ${theme.switch.padding.sm})) / 2
        )`,
      },
    },
  },
});

const Label = styled(Kobalte.Label<"label">, {
  base: {
    marginRight: 10,
    fontWeight: 500,
    userSelect: "none",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
  },
});

type Props = ComponentProps<typeof Kobalte.Root<"div">> & {
  size?: "sm" | "base";
  label?: string;
  description?: string;
  errorMessage?: string;
};

export function Toggle(props: Props) {
  return (
    <Root {...props}>
      <Show when={props.label}>
        <Label>{props.label}</Label>
      </Show>
      <Show when={props.description}>
        <Kobalte.Description>{props.description}</Kobalte.Description>
      </Show>
      <Show when={props.errorMessage}>
        <Kobalte.ErrorMessage>{props.errorMessage}</Kobalte.ErrorMessage>
      </Show>
      <Kobalte.Input />
      <Kobalte.Control class={control} data-size={props.size || "base"}>
        <Thumb />
      </Kobalte.Control>
    </Root>
  );
}
