import { A } from "@solidjs/router";
import { styled } from "@macaron-css/solid";
import { JSX, Show, ComponentProps } from "solid-js";
import { theme } from "./theme";
import { Tag } from "$/ui/tag";
import { Row } from "$/ui/layout";
import { utility } from "$/ui/utility";
import { IconCheck, IconChevronRight } from "$/ui/icons";
import { CSSProperties } from "@macaron-css/core";

const activeBase: CSSProperties = {
  boxShadow: "none",
  transform: "translateY(1px)",
};

const primaryHover: CSSProperties = {
  borderColor: theme.color.button.primary.hover.border,
  backgroundColor: theme.color.button.primary.hover.color,
};
const primaryActive: CSSProperties = {
  borderColor: "transparent",
  backgroundColor: theme.color.button.primary.active,
};
const warningHover: CSSProperties = {
  borderColor: theme.color.button.warning.hover.border,
  backgroundColor: theme.color.button.warning.hover.color,
};
const warningActive: CSSProperties = {
  borderColor: "transparent",
  backgroundColor: theme.color.button.warning.active,
};
const secondaryHover: CSSProperties = {
  borderColor: theme.color.button.secondary.hover.border,
  backgroundColor: theme.color.button.secondary.hover.color,
};
const secondaryActive: CSSProperties = {
  borderColor: theme.color.button.secondary.border,
  backgroundColor: theme.color.button.secondary.active,
};
const successHover: CSSProperties = {
  borderColor: theme.color.button.success.hover.border,
  backgroundColor: theme.color.button.success.hover.color,
};
const successActive: CSSProperties = {
  borderColor: "transparent",
  backgroundColor: theme.color.button.success.active,
};
const dangerHover: CSSProperties = {
  borderColor: theme.color.button.danger.hover.border,
  backgroundColor: theme.color.button.danger.hover.color,
};
const dangerActive: CSSProperties = {
  borderColor: "transparent",
  backgroundColor: theme.color.button.danger.active,
};
const githubHover: CSSProperties = {
  borderColor: theme.color.button.github.hover.border,
  backgroundColor: theme.color.button.github.hover.color,
};
const githubActive: CSSProperties = {
  borderColor: "transparent",
  backgroundColor: theme.color.button.github.active,
};

export const ButtonIcon = styled("span", {
  base: {
    width: 18,
    height: 18,
    marginRight: 6,
    verticalAlign: -4,
    display: "inline-block",
  },
  variants: {
    size: {
      sm: {
        marginRight: 5,
        verticalAlign: -3,
        width: 14,
        height: 14,
      },
    },
  },
});

export const Button = styled("button", {
  base: {
    borderRadius: 4,
    border: "1px solid",
    padding: `0 ${theme.space[4]}`,
    fontWeight: 500,
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    textAlign: "center",
    transitionDelay: "0s, 0s",
    transitionDuration: "0.2s, 0.2s",
    transitionProperty: "background-color, border",
    transitionTimingFunction: "ease-out, ease-out",
    ":disabled": {
      pointerEvents: "none",
    },
    selectors: {
      "&:active": activeBase,
    },
  },
  variants: {
    active: {
      true: {},
      false: {},
    },
    size: {
      base: {
        height: theme.input.size.base,
        fontSize: theme.font.size.mono_sm,
      },
      sm: {
        padding: `0 ${theme.space[2.5]}`,
        height: theme.input.size.sm,
        fontSize: theme.font.size.mono_xs,
      },
    },
    color: {
      primary: {
        backgroundColor: theme.color.button.primary.color,
        borderColor: theme.color.button.primary.border,
        boxShadow: theme.color.button.primary.shadow,
        color: theme.color.button.primary.text,
        ":disabled": {
          boxShadow: "none",
          borderColor: "transparent",
          opacity: theme.color.button.primary.disabled.opacity,
        },
        selectors: {
          "&:hover": primaryHover,
          "&:active": primaryActive,
          "&[data-state-hover]": primaryHover,
        },
      },
      warning: {
        backgroundColor: theme.color.button.warning.color,
        borderColor: theme.color.button.warning.border,
        boxShadow: theme.color.button.warning.shadow,
        color: theme.color.button.warning.text,
        ":disabled": {
          boxShadow: "none",
          borderColor: "transparent",
          opacity: theme.color.button.warning.disabled.opacity,
        },
        selectors: {
          "&:hover": warningHover,
          "&:active": warningActive,
          "&[data-state-hover]": warningHover,
        },
      },
      secondary: {
        backgroundColor: theme.color.button.secondary.color,
        borderColor: theme.color.button.secondary.border,
        boxShadow: theme.color.button.secondary.shadow,
        color: theme.color.button.secondary.text,
        ":disabled": {
          boxShadow: "none",
          opacity: theme.color.button.secondary.disabled.opacity,
        },
        selectors: {
          "&:hover": secondaryHover,
          "&:active": secondaryActive,
          "&[data-state-hover]": secondaryHover,
        },
      },
      success: {
        backgroundColor: theme.color.button.success.color,
        borderColor: theme.color.button.success.border,
        boxShadow: theme.color.button.success.shadow,
        color: theme.color.button.success.text,
        ":disabled": {
          borderColor: "transparent",
          boxShadow: "none",
          opacity: theme.color.button.success.disabled.opacity,
        },
        selectors: {
          "&:hover": successHover,
          "&:active": successActive,
          "&[data-state-hover]": successHover,
        },
      },
      danger: {
        backgroundColor: theme.color.button.danger.color,
        borderColor: theme.color.button.danger.border,
        boxShadow: theme.color.button.danger.shadow,
        color: theme.color.button.danger.text,
        ":disabled": {
          borderColor: "transparent",
          boxShadow: "none",
          opacity: theme.color.button.danger.disabled.opacity,
        },
        selectors: {
          "&:hover": dangerHover,
          "&:active": dangerActive,
          "&[data-state-hover]": dangerHover,
        },
      },
      github: {
        backgroundColor: theme.color.button.github.color,
        borderColor: theme.color.button.github.border,
        boxShadow: theme.color.button.github.shadow,
        color: theme.color.button.github.text,
        ":disabled": {
          borderColor: "transparent",
          boxShadow: "none",
          opacity: theme.color.button.github.disabled.opacity,
        },
        selectors: {
          "&:hover": githubHover,
          "&:active": githubActive,
          "&[data-state-hover]": githubHover,
        },
      },
    },
    grouped: {
      none: {},
      left: {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
      },
      middle: {
        borderRadius: 0,
      },
      right: {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      },
    },
  },
  compoundVariants: [
    {
      variants: {
        active: true,
        color: "primary",
      },
      style: {
        ...activeBase,
        ...primaryActive,
        ":hover": primaryActive,
      },
    },
    {
      variants: {
        active: true,
        color: "secondary",
      },
      style: {
        ...activeBase,
        ...secondaryActive,
        ":hover": secondaryActive,
      },
    },
    {
      variants: {
        active: true,
        color: "success",
      },
      style: {
        ...activeBase,
        ...successActive,
        ":hover": successActive,
      },
    },
    {
      variants: {
        active: true,
        color: "danger",
      },
      style: {
        ...activeBase,
        ...dangerActive,
        ":hover": dangerActive,
      },
    },
    {
      variants: {
        active: true,
        color: "github",
      },
      style: {
        ...activeBase,
        ...githubActive,
        ":hover": githubActive,
      },
    },
  ],
  defaultVariants: {
    size: "base",
    color: "primary",
  },
});

type ButtonGroupProps = ComponentProps<typeof Row> & {};

export function ButtonGroup(props: ButtonGroupProps) {
  return (
    <Row space="px" {...props}>
      {props.children}
    </Row>
  );
}

export const LinkButton = styled("a", {
  base: {
    cursor: "pointer",
    color: theme.color.link.primary.base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    ":hover": {
      color: theme.color.link.primary.hover,
    },
  },
  variants: {
    disabled: {
      true: {
        opacity: 0.65,
        pointerEvents: "none",
      },
      false: {},
    },
    code: {
      true: {
        fontFamily: theme.font.family.code,
      },
      false: {},
    },
    weight: {
      regular: {
        fontWeight: 400,
      },
      medium: {
        fontWeight: 500,
      },
      semibold: {
        fontWeight: 600,
      },
    },
    size: (() => {
      const result = {} as Record<`${keyof typeof theme.font.size}`, any>;
      for (const [key, value] of Object.entries(theme.font.size)) {
        result[key as keyof typeof theme.font.size] = {
          fontSize: value,
        };
      }
      return result;
    })(),
  },
  defaultVariants: {
    code: true,
    size: "mono_sm",
    weight: "medium",
  },
});

const textButtonBaseHover: CSSProperties = {
  color: theme.color.text.primary.base,
};
const textButtonSurfaceHover: CSSProperties = {
  color: theme.color.text.primary.surface,
};

const TextButtonRoot = styled("button", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    transition: `color ${theme.colorFadeDuration} ease-out`,
  },
  variants: {
    disabled: {
      true: {
        opacity: 0.4,
        pointerEvents: "none",
      },
      false: {},
    },
    on: {
      base: {
        color: theme.color.text.secondary.base,
        selectors: {
          "&:hover": textButtonBaseHover,
          "&[data-state-hover]": textButtonBaseHover,
        },
      },
      surface: {
        color: theme.color.text.secondary.surface,
        selectors: {
          "&:hover": textButtonSurfaceHover,
          "&[data-state-hover]": textButtonSurfaceHover,
        },
      },
    },
    completing: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    {
      variants: {
        completing: true,
        on: "base",
      },
      style: {
        color: theme.color.text.secondary.base,
        ":hover": {
          color: theme.color.text.secondary.base,
        },
      },
    },
    {
      variants: {
        completing: true,
        on: "surface",
      },
      style: {
        color: theme.color.text.secondary.surface,
        ":hover": {
          color: theme.color.text.secondary.surface,
        },
      },
    },
  ],
  defaultVariants: {
    on: "base",
    disabled: false,
    completing: false,
  },
});

const TextButtonIcon = styled("span", {
  base: {
    width: 14,
    height: 14,
    marginRight: 4,
    verticalAlign: -2,
    display: "inline-block",
    opacity: theme.iconOpacity,
    selectors: {
      [`${TextButtonRoot.selector({ completing: true })} &`]: {
        color: theme.color.accent,
      },
    },
  },
});

type TextButtonProps = ComponentProps<typeof TextButtonRoot> & {
  icon?: JSX.Element;
  completing?: boolean;
};

export function TextButton(props: TextButtonProps) {
  return (
    <TextButtonRoot {...props}>
      <Show when={props.icon}>
        {props.completing ? (
          <TextButtonIcon>
            <IconCheck />
          </TextButtonIcon>
        ) : (
          <TextButtonIcon>{props.icon}</TextButtonIcon>
        )}
      </Show>
      {props.children}
    </TextButtonRoot>
  );
}

const IconButtonRoot = styled("button", {
  base: {
    display: "inline-block",
    color: theme.color.icon.secondary,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    ":disabled": {
      pointerEvents: "none",
      opacity: 0.4,
    },
    selectors: {
      "&:hover": {
        color: theme.color.icon.primary,
      },

      "&[data-state-hover]": {
        color: theme.color.icon.primary,
      },
    },
  },
});

export function IconButton(props: ComponentProps<typeof IconButtonRoot>) {
  return <IconButtonRoot {...props}>{props.children}</IconButtonRoot>;
}

export const TabTitleRoot = styled("button", {
  base: {},
  variants: {
    state: {
      active: {},
      inactive: {},
      disabled: {
        pointerEvents: "none",
      },
    },
  },
  defaultVariants: {},
});

export const TabTitleText = styled("span", {
  base: {
    fontWeight: 500,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    color: theme.color.text.dimmed.base,
    ":hover": {
      color: theme.color.text.secondary.base,
    },
    selectors: {
      [`a.active &`]: {
        color: theme.color.text.primary.base,
      },
      [`a.active &:hover`]: {
        color: theme.color.text.primary.base,
      },
      [`${TabTitleRoot.selector({ state: "active" })} &`]: {
        color: theme.color.text.primary.base,
      },
      [`${TabTitleRoot.selector({ state: "active" })} &:hover`]: {
        color: theme.color.text.primary.base,
      },
      [`${TabTitleRoot.selector({ state: "disabled" })} &`]: {
        color: theme.color.text.dimmed.base,
        opacity: "0.6",
      },
    },
  },
  variants: {
    size: {
      base: {},
      sm: {
        letterSpacing: 1,
        fontSize: theme.font.size.mono_sm,
      },
    },
  },
});

export const TabTitleCount = styled("div", {
  base: {
    lineHeight: 1,
    display: "flex",
    flex: "0 0 auto",
    borderRadius: 50,
    letterSpacing: 1,
    userSelect: "none",
    padding: "5px 8px",
    textAlign: "center",
    alignItems: "center",
    WebkitUserSelect: "none",
    justifyContent: "center",
    textTransform: "uppercase",
    fontSize: theme.font.size.mono_xs,
    borderColor: theme.color.background.red,
    color: `hsla(${theme.color.red.l2}, 100%)`,
    backgroundColor: theme.color.background.red,
    selectors: {
      [`${TabTitleRoot.selector({ state: "disabled" })} &`]: {
        opacity: "0.6",
      },
    },
  },
});

type TabTitleProps = ComponentProps<typeof TabTitleRoot> & {
  size?: "base" | "sm";
  count?: string;
};

export function TabTitle(props: TabTitleProps) {
  return (
    <TabTitleRoot {...props}>
      <Row space="2" vertical="center">
        <TabTitleText size={props.size}>{props.children}</TabTitleText>
        <Show when={props.count}>
          <TabTitleCount>{props.count}</TabTitleCount>
        </Show>
      </Row>
    </TabTitleRoot>
  );
}

const ChevronLinkRoot = styled(A, {
  base: {
    ...utility.row(0),
    gap: 1,
    alignItems: "center",
    color: theme.color.text.secondary.base,
  },
  variants: {
    size: {
      sm: {
        fontSize: theme.font.size.sm,
      },
    },
    base: {
      fontSize: theme.font.size.base,
    },
  },
});

const ChevronLinkIcon = styled("span", {
  base: {
    flex: "0 0 auto",
    lineHeight: 0,
    opacity: theme.iconOpacity,
  },
  variants: {
    size: {
      sm: {},
    },
    base: {},
  },
});

type ChevronLinkProps = ComponentProps<typeof ChevronLinkRoot> & {
  size?: "sm" | "base";
};

export function ChevronLink(props: ChevronLinkProps) {
  const iconSize = props.size === "sm" ? 12 : 14;
  return (
    <ChevronLinkRoot {...props}>
      {props.children}
      <ChevronLinkIcon size={props.size}>
        <IconChevronRight width={iconSize} height={iconSize} />
      </ChevronLinkIcon>
    </ChevronLinkRoot>
  );
}
