import { CSSProperties } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { theme } from "./theme";
import { utility } from "./utility";
import { ComponentProps, Show } from "solid-js";
import { Stack } from "./layout";
import { JSX } from "solid-js";

export const inputStyles: CSSProperties = {
  border: "none",
  lineHeight: theme.font.lineHeight,
  appearance: "none",
  fontSize: theme.font.size.sm,
  borderRadius: theme.borderRadius,
  padding: `0 ${theme.space[3]}`,
  height: theme.input.size.base,
  backgroundColor: theme.color.input.background,
  // transition: `box-shadow ${theme.colorFadeDuration}`,
  boxShadow: `
    0 0 0 1px inset ${theme.color.input.border},
    ${theme.color.input.shadow}
  `,
};

export const inputDisabledStyles: CSSProperties = {
  opacity: 0.5,
  backgroundColor: theme.color.background.surface,
  color: theme.color.text.dimmed.base,
  cursor: "default",
  boxShadow: `0 0 0 1px inset ${theme.color.input.border}`,
};

export const inputFocusStyles: CSSProperties = {
  outlineOffset: 0,
  outline: `hsla(${theme.color.blue.d1}, 100%) solid 1px`,
};

export const inputDangerTextStyles: CSSProperties = {
  color: theme.color.text.danger.base,
};

export const inputDangerFocusStyles: CSSProperties = {
  ...inputDangerTextStyles,
  outlineColor: `hsla(${theme.color.red.l2}, 50%)`,
  boxShadow: `
    0 0 1px 1px inset hsla(${theme.color.red.l2}, 100%),
    ${theme.color.input.shadow}
  `,
};

export const Root = styled("label", {
  base: {
    ...utility.stack(2),
  },
  variants: {
    color: {
      primary: {},
      danger: {},
    },
  },
  defaultVariants: {
    color: "primary",
  },
});

export const Input = styled("input", {
  base: {
    ...inputStyles,
    ":focus": {
      ...inputFocusStyles,
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
    color: {
      primary: {},
      danger: {
        ...inputDangerFocusStyles,
        ":focus": {
          ...inputDangerFocusStyles,
        },
      },
    },
    size: {
      sm: {
        height: theme.input.size.sm,
      },
    },
  },
  defaultVariants: {
    color: "primary",
  },
});

export const Textarea = styled("textarea", {
  base: {
    ...inputStyles,
    padding: `${theme.space[2]} ${theme.space[3]}`,
    ":focus": {
      ...inputFocusStyles,
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
    color: {
      primary: {},
      danger: {
        ...inputDangerFocusStyles,
        ":focus": {
          ...inputDangerFocusStyles,
        },
      },
    },
  },
  defaultVariants: {
    color: "primary",
  },
});

const Label = styled("p", {
  base: {
    fontWeight: 500,
    letterSpacing: 0.5,
    fontSize: theme.font.size.mono_sm,
    textTransform: "uppercase",
    fontFamily: theme.font.family.heading,
  },
});

const Hint = styled("p", {
  base: {
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.dimmed.base,
  },
  variants: {
    color: {
      primary: {},
      danger: {
        color: `hsla(${theme.color.red.l2}, 100%)`,
      },
    },
  },
  defaultVariants: {
    color: "primary",
  },
});

type FormFieldProps = ComponentProps<typeof Root> & {
  hint?: JSX.Element;
  label?: string;
};

export function FormField(props: FormFieldProps) {
  return (
    <Root {...props}>
      <Stack space="3">
        <Show when={props.label}>
          <Label color={props.color}>{props.label}</Label>
        </Show>
        {props.children}
      </Stack>
      <Show when={props.hint}>
        <Hint color={props.color}>{props.hint!}</Hint>
      </Show>
    </Root>
  );
}

const SplitOptionsRoot = styled("div", {
  base: {
    ...inputStyles,
    ...utility.row(0),
    padding: 1,
  },
  variants: {
    size: {
      base: {
        height: theme.input.size.base,
      },
      sm: {
        height: theme.input.size.sm,
      },
    },
  },
  defaultVariants: {
    size: "base",
  },
});

const SplitOptionsOptionRoot = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    padding: inputStyles.padding,
    borderRight: `1px solid ${theme.color.input.border}`,
    ":last-child": {
      borderRight: "none",
    },
  },
  variants: {
    selected: {
      true: {
        backgroundColor: theme.color.background.surface,
        color: theme.color.text.primary.surface,
        cursor: "default",
      },
      false: {},
    },
  },
  defaultVariants: {
    selected: false,
  },
});

const SplitOptionsOptionText = styled("span", {
  base: {
    selectors: {
      [`${SplitOptionsOptionRoot.selector({ selected: true })} &`]: {
        color: theme.color.text.primary.surface,
      },
      [`${SplitOptionsOptionRoot.selector({ selected: false })} &`]: {
        color: theme.color.text.secondary.base,
      },
      [`${SplitOptionsRoot.selector({ size: "base" })} &`]: {
        fontSize: theme.font.size.sm,
      },
      [`${SplitOptionsRoot.selector({ size: "sm" })} &`]: {
        fontSize: theme.font.size.xs,
      },
    },
  },
});

type SplitOptionsOptionProps = ComponentProps<
  typeof SplitOptionsOptionRoot
> & {};

export function SplitOptionsOption(props: SplitOptionsOptionProps) {
  return (
    <SplitOptionsOptionRoot {...props}>
      <SplitOptionsOptionText>{props.children}</SplitOptionsOptionText>
    </SplitOptionsOptionRoot>
  );
}

type SplitOptionsProps = ComponentProps<typeof SplitOptionsRoot> & {};

export function SplitOptions(props: SplitOptionsProps) {
  return <SplitOptionsRoot {...props}>{props.children}</SplitOptionsRoot>;
}

/*
const chevronDownString = `
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'>
    <path stroke='#767681' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/>
  </svg>
`;

export const Select = styled("select", {
  base: {
    ...inputStyles,
    backgroundRepeat: "no-repeat",
    backgroundSize: "1.25rem 1.25rem",
    backgroundPosition: "bottom 50% right 0.5rem",
    backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
      chevronDownString
    )}")`,
    paddingRight: theme.space[10],
    ":focus": {
      ...inputFocusStyles,
    },
    ":invalid": {
      color: theme.color.text.dimmed.base,
    },
    ":disabled": {
      ...inputDisabledStyles,
    },
  },
  variants: {
    color: {
      primary: {},
      danger: {
        ...inputDangerFocusStyles,
        ":focus": {
          ...inputDangerFocusStyles,
        },
      },
    },
  },
  defaultVariants: {
    color: "primary",
  },
});
*/
