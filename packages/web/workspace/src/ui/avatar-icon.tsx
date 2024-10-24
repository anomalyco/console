import { styled } from "@macaron-css/solid";
import { theme } from "./theme";
import { createMemo, ComponentProps } from "solid-js";

interface AvatarSvgProps {
  text: string;
  size?: number;
  round?: boolean;
  bgColor?: string;
  fontSize?: number;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: number | string;
}
function generateAvatarSvg({
  text,
  size = 64,
  round = false,
  fontSize = 0.4,
  bgColor = "#395C6B",
  textColor = "#FFFBF9",
  fontWeight = "normal",
  fontFamily = "monospace",
}: AvatarSvgProps) {
  // From https://github.com/gilbitron/ui-avatar-svg
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}px" height="${size}px" viewBox="0 0 ${size} ${size}" version="1.1"><${
    round ? "circle" : "rect"
  } fill="${bgColor}" width="${size}" height="${size}" cx="${size / 2}" cy="${
    size / 2
  }" r="${
    size / 2
  }"/><text x="50%" y="50%" style="color: ${textColor};line-height: 1;font-family: ${fontFamily};" alignment-baseline="middle" text-anchor="middle" font-size="${Math.round(
    size * fontSize,
  )}" font-weight="${fontWeight}" dy=".1em" dominant-baseline="middle" fill="${textColor}">${text}</text></svg>`;
}

const Icon = styled("span", {
  base: {
    flexShrink: 0,
    width: 36,
    height: 36,
    display: "inline-block",
    backgroundSize: "cover",
  },
  variants: {
    type: {
      workspace: {
        borderRadius: theme.borderRadius,
      },
      user: {},
    },
  },
});

type AvatarInitialsIconProps = ComponentProps<typeof Icon> & {
  text: string;
};
export function AvatarInitialsIcon(props: AvatarInitialsIconProps) {
  const svg = createMemo(() => {
    const bgColor = props.type === "user" ? "#606165" : "#395C6B";
    const round = props.type === "user";
    const parts = props.text
      .replace(/@.*$/, "")
      .toUpperCase()
      .split(/[^A-Z0-9]/g)
      .filter((p) => p.trim() !== "");

    const text =
      parts.length > 1
        ? parts[0].slice(0, 1) + parts[1].slice(0, 1)
        : parts.length === 1
          ? parts[0][0]
          : "-";

    return encodeURIComponent(
      generateAvatarSvg({
        text,
        round,
        bgColor,
      }),
    );
  });

  return (
    <Icon
      {...props}
      title={props.text}
      style={{
        ...(typeof props.style === "object" ? props.style : {}),
        "background-image": `url("data:image/svg+xml;utf8,${svg()}")`,
      }}
    />
  );
}
