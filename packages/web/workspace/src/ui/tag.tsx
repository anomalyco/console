import { styled } from "@macaron-css/solid";
import { theme } from "./theme";

export const Tag = styled("div", {
  base: {
    flex: "0 0 auto",
    letterSpacing: 0.5,
    justifyContent: "center",
    textAlign: "center",
    fontSize: theme.font.size.mono_xs,
    height: 26,
    display: "flex",
    alignItems: "center",
    textTransform: "uppercase",
    borderRadius: theme.borderRadius,
    lineHeight: 1,
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  variants: {
    level: {
      info: {
        borderColor: theme.color.background.surface,
        backgroundColor: theme.color.background.surface,
        color: theme.color.text.dimmed.base,
      },
      tip: {
        borderColor: theme.color.background.blue,
        backgroundColor: theme.color.background.blue,
        color: `hsla(${theme.color.blue.l2}, 100%)`,
      },
      caution: {
        borderColor: theme.color.background.accent,
        backgroundColor: theme.color.background.accent,
        color: `hsla(${theme.color.brand.l2}, 100%)`,
      },
      danger: {
        borderColor: theme.color.background.red,
        backgroundColor: theme.color.background.red,
        color: `hsla(${theme.color.red.l2}, 100%)`,
      },
    },
    type: {
      solid: {
        padding: "0 9px",
        fontWeight: 500,
      },
      outline: {
        lineHeight: "normal",
        padding: "0 8px",
        borderWidth: 1,
        borderStyle: "solid",
        backgroundColor: "transparent",
      },
    },
    size: {
      large: {
        width: 114,
      },
      small: {
        width: 66,
      },
      auto: {},
    },
  },
  compoundVariants: [
    {
      variants: {
        level: "info",
        type: "outline",
      },
      style: {
        color: theme.color.text.dimmed.base,
        borderColor: theme.color.divider.base,
      },
    },
    {
      variants: {
        level: "danger",
        type: "outline",
      },
      style: {
        color: `hsla(${theme.color.base.red}, 100%)`,
      },
    },
    {
      variants: {
        level: "tip",
        type: "outline",
      },
      style: {
        color: `hsla(${theme.color.base.blue}, 100%)`,
      },
    },
    {
      variants: {
        level: "caution",
        type: "outline",
      },
      style: {
        color: `hsla(${theme.color.base.brand}, 100%)`,
      },
    },
  ],
  defaultVariants: {
    size: "auto",
    level: "info",
    type: "solid",
  },
});
