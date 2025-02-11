import { createTheme } from "@macaron-css/core";

const font = {
  lineHeight: "1.6",
  family: {
    heading: '"IBM Plex Mono", monospace',
    body: "Rubik, sans-serif",
    code: '"IBM Plex Mono", monospace',
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  size: {
    mono_xs: "0.6875rem",
    xs: "0.75rem",
    mono_sm: "0.8125rem",
    sm: "0.875rem",
    mono_base: "0.9375rem",
    base: "1rem",
    mono_lg: "1.0625rem",
    lg: "1.125rem",
    mono_xl: "1.1875rem",
    xl: "1.25rem",
    mono_2xl: "1.375rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
    "6xl": "3.75rem",
    "7xl": "4.5rem",
    "8xl": "6rem",
    "9xl": "8rem",
  },
};

const formInput = {
  size: {
    base: "40px",
    sm: "32px",
  },
};

const formSwitch = {
  size: {
    base: "32px",
    sm: "24px",
  },
  padding: {
    base: "4px",
    sm: "3px",
  },
};

const constants = {
  colorFadeDuration: "0.15s",
  borderRadius: "4px",
  textBoldWeight: "600",
  iconOpacity: "0.85",
  modalWidth: {
    sm: "480px",
    md: "640px",
    lg: "800px",
  },
  headerHeight: {
    root: "68px",
    stage: "52px",
  },
};

const space = {
  px: "1px",
  0: "0px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  11: "2.75rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  36: "9rem",
  40: "10rem",
  44: "11rem",
  48: "12rem",
  52: "13rem",
  56: "14rem",
  60: "15rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
};

const color = {
  base: {
    brand: "13, 88%",
    yellow: "43, 95%",
    white: "0, 0%",
    black: "240, 28%",
    blue: "198, 39%",
    red: "2, 84%",
  },
};

const light = (() => {
  const base = {
    brand: `${color.base.brand}, 60%`,
    yellow: `${color.base.yellow}, 48%`,
    white: `${color.base.white}, 100%`,
    black: `${color.base.black}, 14%`,
    blue: `${color.base.blue}, 51%`,
    red: `${color.base.red}, 55%`,
    gray: `${color.base.white}, 97%`,
  };

  const brand = {
    d4: `${color.base.brand}, 36%`,
    d3: `${color.base.brand}, 42%`,
    d2: `${color.base.brand}, 48%`,
    d1: `${color.base.brand}, 54%`,
    l1: `${color.base.brand}, 66%`,
    l2: `${color.base.brand}, 72%`,
  };

  const yellow = {
    d4: `${color.base.yellow}, 27%`,
    d3: `${color.base.yellow}, 33%`,
    d2: `${color.base.yellow}, 39%`,
    d1: `${color.base.yellow}, 45%`,
    l1: `${color.base.yellow}, 57%`,
    l2: `${color.base.yellow}, 63%`,
  };

  const blue = {
    d2: `${color.base.blue}, 39%`,
    d1: `${color.base.blue}, 45%`,
    l1: `${color.base.blue}, 57%`,
    l2: `${color.base.blue}, 63%`,
    l3: `${color.base.blue}, 69%`,
    l4: `${color.base.blue}, 75%`,
  };

  const black = {
    d1: `${color.base.black}, 10%`,
  };

  const red = {
    d4: `${color.base.red}, 31%`,
    d3: `${color.base.red}, 37%`,
    d2: `${color.base.red}, 43%`,
    d1: `${color.base.red}, 49%`,
    l1: `${color.base.red}, 61%`,
    l2: `${color.base.red}, 67%`,
  };

  const accent = `hsla(${base.brand}, 100%)`;

  const background = {
    base: `hsla(${base.white}, 100%)`,
    hover: `hsla(${base.black}, 4%)`,
    selected: `hsla(${base.black}, 7%)`,
    surface: `hsla(${base.black}, 3%)`,
    modal: `hsla(${base.gray}, 93%)`,
    popup: `hsla(${base.gray}, 63%)`,
    overlay: `hsla(${base.black}, 3%)`,
    navbar: `hsla(${base.white}, 80%)`,
    blue: `hsla(${base.blue}, 25%)`,
    red: `hsla(${base.red}, 25%)`,
    accent: `hsla(${base.brand}, 25%)`,
  };

  const divider = {
    base: `hsla(${base.black}, 8%)`,
    surface: `hsla(${base.black}, 6%)`,
    danger: `hsla(${red.l2}, 20%)`,
  };

  const text = {
    primary: {
      base: `hsla(${base.black}, 93%)`,
      surface: `hsla(${base.black}, 78%)`,
      inverted: `hsla(${base.white}, 87%)`,
    },
    secondary: {
      base: `hsla(${base.black}, 60%)`,
      surface: `hsla(${base.black}, 45%)`,
      inverted: `hsla(${base.white}, 60%)`,
    },
    dimmed: {
      base: `hsla(${base.black}, 38%)`,
      surface: `hsla(${base.black}, 23%)`,
      inverted: `hsla(${base.white}, 38%)`,
    },
    danger: {
      base: `hsla(${base.red}, 90%)`,
      surface: `hsla(${red.l1}, 100%)`,
      inverted: `hsla(${red.l1}, 90%)`,
    },
  };

  const icon = {
    primary: `hsla(${base.black}, 91%)`,
    secondary: `hsla(${base.black}, 51%)`,
    dimmed: `hsla(${base.black}, 32%)`,
  };

  const link = {
    primary: {
      base: `hsla(${base.blue}, 100%)`,
      hover: `hsla(${blue.d1}, 100%)`,
    },
  };

  const input = {
    border: `hsla(${base.black}, 14%)`,
    shadow: `0 1px 2px hsla(${black.d1}, 0.02)`,
    background: "transparent",
  };

  const formSwitch = {
    base: {
      background: `hsla(${base.black}, 9%)`,
      border: `hsla(${base.black}, 4%)`,
    },
    selected: {
      background: `hsla(${base.blue}, 100%)`,
      border: `hsla(${base.blue}, 100%)`,
    },
  };

  const shadow = {
    inset: {
      surface: `0 1px 0 inset hsla(${base.white}, 54%)`,
      accent: `0 1px 0 inset hsla(${brand.l2}, 80%)`,
      warning: `0 1px 0 inset hsla(${yellow.l2}, 80%)`,
      danger: `0 1px 0 inset hsla(${red.l2}, 80%)`,
      success: `0 1px 0 inset hsla(${blue.l2}, 80%)`,
    },
    drop: {
      short: `0 1px 1px hsla(${black.d1}, 0.03),
      0 2px 2px hsla(${black.d1}, 0.03)`,
      shortDark: `0 1px 1px hsla(${black.d1}, 0.1),
        0 2px 2px hsla(${black.d1}, 0.1)`,
      medium: `0 1px 1px hsla(${black.d1}, 0.01),
          0 2px 2px hsla(${black.d1}, 0.01),
          0 4px 4px hsla(${black.d1}, 0.01),
          0 8px 8px hsla(${black.d1}, 0.01),
          0 10px 10px hsla(${black.d1}, 0.01)
          `,
      long: `
        0 2px 4px hsla(${black.d1}, 0.05),
        0 4px 8px hsla(${black.d1}, 0.05),
        0 8px 16px hsla(${black.d1}, 0.07),
        0 16px 32px hsla(${black.d1}, 0.07),
        0 32px 64px hsla(${black.d1}, 0.07),
        0 48px 96px hsla(${black.d1}, 0.07)
      `,
    },
  };

  const gradient = {
    fadeBackground: `linear-gradient(hsla(${base.white}, 0) 0% , hsla(${base.white}, .5) 50%, hsla(${base.white}, 100%) 90%)`,
  };

  const button = {
    primary: {
      text: text.primary.inverted,
      color: accent,
      active: `hsla(${brand.d1}, 100%)`,
      border: `hsla(${brand.d2}, 100%)`,
      hover: {
        color: `hsla(${brand.l1}, 100%)`,
        border: `hsla(${brand.d1}, 100%)`,
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: `${shadow.inset.accent}, ${shadow.drop.shortDark}`,
    },
    warning: {
      text: text.primary.inverted,
      color: `hsla(${base.yellow}, 100%)`,
      active: `hsla(${yellow.d1}, 100%)`,
      border: `hsla(${yellow.d1}, 100%)`,
      hover: {
        color: `hsla(${yellow.l1}, 100%)`,
        border: `hsla(${yellow.d1}, 100%)`,
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: `${shadow.inset.warning}, ${shadow.drop.shortDark}`,
    },
    secondary: {
      text: text.primary.surface,
      color: background.surface,
      active: `hsla(${base.black}, 8%)`,
      border: `hsla(${base.black}, 5%)`,
      hover: {
        color: `hsla(${base.black}, 1%)`,
        border: `hsla(${base.black}, 5%)`,
      },
      disabled: {
        opacity: "0.6",
      },
      shadow: `${shadow.inset.surface}, ${shadow.drop.short}`,
    },
    success: {
      text: text.primary.inverted,
      color: `hsla(${base.blue}, 100%)`,
      active: `hsla(${blue.d1}, 100%)`,
      border: `hsla(${blue.d2}, 100%)`,
      hover: {
        color: `hsla(${blue.l1}, 100%)`,
        border: `hsla(${blue.d1}, 100%)`,
      },
      disabled: {
        opacity: "0.6",
      },
      shadow: `${shadow.inset.success}, ${shadow.drop.shortDark}`,
    },
    danger: {
      text: text.primary.inverted,
      color: `hsla(${base.red}, 100%)`,
      active: `hsla(${red.d1}, 100%)`,
      border: `hsla(${red.d2}, 100%)`,
      hover: {
        color: `hsla(${red.l1}, 100%)`,
        border: `hsla(${red.d1}, 100%)`,
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: `${shadow.inset.danger}, ${shadow.drop.shortDark}`,
    },
    github: {
      text: text.primary.inverted,
      color: "hsla(0, 0%, 20%, 100%)",
      active: "hsla(0, 0%, 14%, 100%)",
      border: "hsla(0, 0%, 8%, 100%)",
      hover: {
        color: "hsla(0, 0%, 26%, 100%)",
        border: "hsla(0, 0%, 14%, 100%)",
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: shadow.drop.shortDark,
    },
  };


  return {
    base,
    brand,
    yellow,
    blue,
    black,
    red,
    accent,
    background,
    divider,
    text,
    icon,
    link,
    input,
    shadow,
    button,
    gradient,
    switch: formSwitch,
  };
})();

const dark = ((): typeof light => {
  const base = {
    brand: `${color.base.brand}, 58%`,
    yellow: `${color.base.yellow}, 44%`,
    white: `${color.base.white}, 100%`,
    black: `${color.base.black}, 14%`,
    blue: `${color.base.blue}, 56%`,
    red: `${color.base.red}, 60%`,
    gray: `240, 19%, 18%`,
  };

  const brand = {
    d4: `${color.base.brand}, 34%`,
    d3: `${color.base.brand}, 40%`,
    d2: `${color.base.brand}, 46%`,
    d1: `${color.base.brand}, 52%`,
    l1: `${color.base.brand}, 64%`,
    l2: `${color.base.brand}, 70%`,
  };

  const yellow = {
    d4: `${color.base.yellow}, 24%`,
    d3: `${color.base.yellow}, 30%`,
    d2: `${color.base.yellow}, 36%`,
    d1: `${color.base.yellow}, 42%`,
    l1: `${color.base.yellow}, 54%`,
    l2: `${color.base.yellow}, 60%`,
  };

  const blue = {
    d2: `${color.base.blue}, 44%`,
    d1: `${color.base.blue}, 50%`,
    l1: `${color.base.blue}, 62%`,
    l2: `${color.base.blue}, 68%`,
    l3: `${color.base.blue}, 74%`,
    l4: `${color.base.blue}, 80%`,
  };

  const black = {
    d1: `${color.base.black}, 10%`,
  };

  const red = {
    d4: `${color.base.red}, 36%`,
    d3: `${color.base.red}, 42%`,
    d2: `${color.base.red}, 48%`,
    d1: `${color.base.red}, 54%`,
    l1: `${color.base.red}, 62%`,
    l2: `${color.base.red}, 68%`,
  };

  const accent = `hsla(${base.brand}, 100%)`;

  const background = {
    base: `hsla(${base.black}, 100%)`,
    hover: `hsla(${base.white}, 4%)`,
    selected: `hsla(${base.white}, 7%)`,
    surface: `hsla(${base.white}, 5%)`,
    modal: `hsla(${base.gray}, 91%)`,
    popup: `hsla(${base.gray}, 66%)`,
    overlay: `hsla(${base.black}, 50%)`,
    navbar: `hsla(${base.black}, 75%)`,
    blue: `hsla(${base.blue}, 25%)`,
    red: `hsla(${base.red}, 25%)`,
    accent: `hsla(${base.brand}, 25%)`,
  };

  const divider = {
    base: `hsla(${base.white}, 6%)`,
    surface: `hsla(${base.white}, 8%)`,
    danger: `hsla(${red.l2}, 13%)`,
  };

  const text = {
    primary: {
      base: `hsla(${base.white}, 87%)`,
      surface: `hsla(${base.white}, 80%)`,
      inverted: `hsla(${base.black}, 93%)`,
    },
    secondary: {
      base: `hsla(${base.white}, 60%)`,
      surface: `hsla(${base.white}, 53%)`,
      inverted: `hsla(${base.black}, 60%)`,
    },
    dimmed: {
      base: `hsla(${base.white}, 38%)`,
      surface: `hsla(${base.white}, 31%)`,
      inverted: `hsla(${base.black}, 38%)`,
    },
    danger: {
      base: `hsla(${red.l1}, 90%)`,
      surface: `hsla(${red.l1}, 100%)`,
      inverted: `hsla(${base.red}, 100%)`,
    },
  };

  const icon = {
    primary: `hsla(${base.white}, 74%)`,
    secondary: `hsla(${base.white}, 51%)`,
    dimmed: `hsla(${base.white}, 32%)`,
  };

  const link = {
    primary: {
      base: `hsla(${base.blue}, 100%)`,
      hover: `hsla(${blue.d1}, 100%)`,
    },
  };

  const input = {
    border: `hsla(${base.white}, 12%)`,
    shadow: `0 1px 2px hsla(${black.d1}, 0.2)`,
    background: `hsla(${base.white}, 4%)`,
  };

  const formSwitch = {
    base: {
      background: `hsla(${base.white}, 19%)`,
      border: `hsla(${base.white}, 4%)`,
    },
    selected: {
      background: `hsla(${base.blue}, 100%)`,
      border: `hsla(${base.blue}, 100%)`,
    },
  };

  const shadow = {
    inset: {
      surface: "",
      accent: "",
      warning: "",
      danger: "",
      success: "",
    },
    drop: {
      short: `0 1px 1px hsla(${black.d1}, 0.4),
    0 2px 2px hsla(${black.d1}, 0.4)`,
      shortDark: `0 1px 1px hsla(${black.d1}, 0.65),
    0 2px 2px hsla(${black.d1}, 0.5)`,
      medium: `0 1px 1px hsla(${black.d1}, 0.075),
    0 2px 2px hsla(${black.d1}, 0.075),
    0 4px 4px hsla(${black.d1}, 0.075),
    0 8px 8px hsla(${black.d1}, 0.075),
    0 10px 10px hsla(${black.d1}, 0.075)`,
      long: `
    0 2px 10px rgba(0, 0, 0, 0.1),
    0 8px 20px rgba(0, 0, 0, 0.1),
    0 16px 40px rgba(0, 0, 0, 0.1),
    0 32px 80px rgba(0, 0, 0, 0.15),
    0 48px 120px rgba(0, 0, 0, 0.15)
  `,
    },
  };

  const gradient = {
    fadeBackground: `linear-gradient(hsla(${base.black}, 0) 0%, hsla(${base.black}, .5) 50%, hsla(${base.black}, 100%) 90%)`,
  };

  const button = {
    primary: {
      text: text.primary.surface,
      color: accent,
      active: `hsla(${brand.d1}, 100%)`,
      border: accent,
      hover: {
        color: `hsla(${brand.l1}, 100%)`,
        border: `hsla(${brand.l1}, 100%)`,
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: shadow.drop.shortDark,
    },
    warning: {
      text: text.primary.surface,
      color: `hsla(${base.yellow}, 100%)`,
      active: `hsla(${yellow.d1}, 100%)`,
      border: `hsla(${base.yellow}, 100%)`,
      hover: {
        color: `hsla(${yellow.l1}, 100%)`,
        border: `hsla(${yellow.l1}, 100%)`,
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: shadow.drop.shortDark,
    },
    secondary: {
      text: text.primary.surface,
      color: background.surface,
      active: `hsla(${base.white}, 4%)`,
      border: `hsla(${base.white}, 4%)`,
      hover: {
        color: `hsla(${base.white}, 9%)`,
        border: `hsla(${base.white}, 3%)`,
      },
      disabled: {
        opacity: "0.6",
      },
      shadow: shadow.drop.shortDark,
    },
    success: {
      text: text.primary.surface,
      color: `hsla(${base.blue}, 100%)`,
      active: `hsla(${blue.d1}, 100%)`,
      border: `hsla(${base.blue}, 100%)`,
      hover: {
        color: `hsla(${blue.l1}, 100%)`,
        border: `hsla(${blue.l1}, 100%)`,
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: shadow.drop.shortDark,
    },
    danger: {
      text: text.primary.surface,
      color: `hsla(${base.red}, 100%)`,
      active: `hsla(${red.d1}, 100%)`,
      border: `hsla(${base.red}, 100%)`,
      hover: {
        color: `hsla(${red.l1}, 100%)`,
        border: `hsla(${red.l1}, 100%)`,
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: shadow.drop.shortDark,
    },
    github: {
      text: text.primary.inverted,
      color: "hsla(0, 0%, 96%, 100%)",
      active: "hsla(0, 0%, 86%, 100%)",
      border: "hsla(0, 0%, 96%, 100%)",
      hover: {
        color: "hsla(0, 0%, 100%, 100%)",
        border: "hsla(0, 0%, 100%, 100%)",
      },
      disabled: {
        opacity: "0.65",
      },
      shadow: shadow.drop.shortDark,
    },
  };

  return {
    base,
    brand,
    yellow,
    blue,
    black,
    red,
    accent,
    background,
    divider,
    text,
    icon,
    link,
    input,
    shadow,
    button,
    gradient,
    switch: formSwitch,
  };
})();

export const [lightClass, theme] = createTheme({
  ...constants,
  space,
  font,
  color: light,
  input: formInput,
  switch: formSwitch,
});

export const darkClass = createTheme(theme, {
  ...theme,
  ...constants,
  space,
  font,
  color: dark,
  input: formInput,
  switch: formSwitch,
});
