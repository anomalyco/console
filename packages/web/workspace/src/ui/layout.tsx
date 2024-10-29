import { styled } from "@macaron-css/solid";
import { theme } from "./theme";

export const Stack = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
  },
  variants: {
    space: (() => {
      const result = {} as Record<`${keyof (typeof theme)["space"]}`, any>;
      for (const key in theme.space) {
        const value = theme.space[key as keyof typeof theme.space];
        result[key as keyof typeof theme.space] = {
          gap: value,
        };
      }
      return result;
    })(),
    flex: {
      true: {
        flex: "1 1 auto",
      },
      false: {
        flex: "0 0 auto",
      },
    },
    horizontal: {
      center: {
        alignItems: "center",
      },
      start: {
        alignItems: "flex-start",
      },
      end: {
        alignItems: "flex-end",
      },
    },
    vertical: {
      center: {
        justifyContent: "center",
      },
      start: {
        justifyContent: "flex-start",
      },
      end: {
        justifyContent: "flex-end",
      },
    },
  },
});

export const Row = styled("div", {
  base: {
    display: "flex",
    // For overflow hidden
    // https://dfmcphee.com/flex-items-and-min-width-0/
    minWidth: 0,
  },
  variants: {
    space: (() => {
      const result = {} as Record<`${keyof (typeof theme)["space"]}`, any>;
      for (const key in theme.space) {
        const value = theme.space[key as keyof typeof theme.space];
        result[key as keyof typeof theme.space] = {
          gap: value,
        };
      }
      return result;
    })(),
    flex: {
      true: {
        flex: "1 1 auto",
      },
      false: {
        flex: "0 0 auto",
      },
    },
    vertical: {
      center: {
        alignItems: "center",
      },
      start: {
        alignItems: "flex-start",
      },
      end: {
        alignItems: "flex-end",
      },
    },
    horizontal: {
      center: {
        justifyContent: "center",
      },
      start: {
        justifyContent: "flex-start",
      },
      end: {
        justifyContent: "flex-end",
      },
      between: {
        justifyContent: "space-between",
      },
    },
  },
});

export const Grower = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
  },
});

export const Fullscreen = styled("div", {
  base: {
    inset: 0,
    display: "flex",
    position: "fixed",
    alignItems: "center",
    justifyContent: "center",
  },
  variants: {
    inset: {
      none: {},
      header: {
        top: theme.headerHeight.root,
      },
      "header-tabs": {
        top: `calc(${theme.headerHeight.root} + ${theme.headerHeight.stage})`,
      },
    },
  },
});

export const Hr = styled("hr", {
  base: {
    margin: 0,
    height: 1,
    border: 0,
    width: "100%",
    backgroundColor: theme.color.divider.base,
  },
});

export const DivSpacer = styled("div", {
  base: {
    flex: "0 0 auto",
  },
  variants: {
    space: (() => {
      const result = {} as Record<`${keyof (typeof theme)["space"]}`, any>;
      for (const key in theme.space) {
        const value = theme.space[key as keyof typeof theme.space];
        result[key as keyof typeof theme.space] = {
          height: value,
        };
      }
      return result;
    })(),
  },
});

export const SpanSpacer = styled("span", {
  base: {},
  variants: {
    space: (() => {
      const result = {} as Record<`${keyof (typeof theme)["space"]}`, any>;
      for (const key in theme.space) {
        const value = theme.space[key as keyof typeof theme.space];
        result[key as keyof typeof theme.space] = {
          paddingLeft: value,
        };
      }
      return result;
    })(),
  },
});
