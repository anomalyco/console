import { style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { ComponentProps } from "solid-js";
import { Row, Stack } from "./layout";
import { IconXCircle, IconExclamationTriangle } from "./icons";
import { theme } from "./theme";

const AlertRoot = styled("div", {
  base: {
    padding: theme.space[4],
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.surface,
  },
  variants: {
    level: {
      info: {
        backgroundColor: theme.color.background.surface,
      },
      danger: {
        backgroundColor: theme.color.background.red,
      },
    },
  },
});

const AlertIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 16,
    height: 16,
    marginTop: 3,
    opacity: theme.iconOpacity,
    selectors: {
      [`${AlertRoot.selector({ level: "info" })} &`]: {
        color: theme.color.text.secondary.base,
      },
      [`${AlertRoot.selector({ level: "danger" })} &`]: {
        color: `hsla(${theme.color.red.l2}, 100%)`,
      },
    },
  },
});

const AlertText = styled("div", {
  base: {
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    selectors: {
      [`${AlertRoot.selector({ level: "info" })} &`]: {
        color: theme.color.text.secondary.base,
      },
      [`${AlertRoot.selector({ level: "danger" })} &`]: {
        color: `hsla(${theme.color.red.l2}, 100%)`,
      },
    },
  },
});

const AlertDetails = styled("div", {
  base: {
    borderStyle: "solid",
    borderWidth: "1px 0 0 0",
    paddingTop: theme.space[3],
    selectors: {
      [`${AlertRoot.selector({ level: "info" })} &`]: {
        borderColor: theme.color.divider.surface,
      },
      [`${AlertRoot.selector({ level: "danger" })} &`]: {
        borderColor: theme.color.divider.danger,
      },
    },
  },
});

const AlertDetailsText = styled("div", {
  base: {
    overflowY: "auto",
    maxHeight: 140,
  },
});

const alertDetailsTextCs = style({
  selectors: {
    [`${AlertRoot.selector({ level: "info" })} &`]: {
      color: theme.color.text.secondary.base,
    },
    [`${AlertRoot.selector({ level: "danger" })} &`]: {
      color: `hsla(${theme.color.red.l2}, 100%)`,
    },
  },
});

type AlertProps = ComponentProps<typeof AlertRoot> & {};
export function Alert(props: AlertProps) {
  return (
    <AlertRoot {...props}>
      <Row space="4" vertical="start" horizontal="between">
        <Row flex space="2.5" vertical="start">
          <AlertIcon>
            {props.level === "danger" ? (
              <IconXCircle />
            ) : (
              <IconExclamationTriangle />
            )}
          </AlertIcon>
          <Stack flex space="3" style={{ flex: "1" }}>
            <AlertText>{props.children}</AlertText>
          </Stack>
        </Row>
      </Row>
    </AlertRoot>
  );
}
