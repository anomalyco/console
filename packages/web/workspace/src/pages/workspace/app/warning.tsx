import { JSX } from "solid-js";
import { styled } from "@macaron-css/solid";
import { IconExclamationTriangle } from "@console/web/ui/icons";
import { Stack } from "@console/web/ui/layout";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { useWorkspace } from "../context";
import { A } from "@solidjs/router";

const WarningRoot = styled("div", {
  base: {
    ...utility.stack(8),
    marginTop: "-7vh",
    alignItems: "center",
    width: 400,
  },
});

const WarningIcon = styled("div", {
  base: {
    width: 42,
    height: 42,
    color: theme.color.icon.dimmed,
  },
});

const WarningTitle = styled("span", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
  },
});

const WarningDescription = styled("span", {
  base: {
    textAlign: "center",
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.secondary.base,
  },
});

interface WarningProps {
  title: JSX.Element;
  description: JSX.Element;
}

export function Warning(props: WarningProps) {
  return (
    <WarningRoot>
      <Stack horizontal="center" space="5">
        <WarningIcon>
          <IconExclamationTriangle />
        </WarningIcon>
        <Stack horizontal="center" space="2">
          <WarningTitle>{props.title}</WarningTitle>
          <WarningDescription>{props.description}</WarningDescription>
        </Stack>
      </Stack>
    </WarningRoot>
  );
}

export function GatedWarning() {
  const workspace = useWorkspace();
  return (
    <Warning
      title="Update billing details"
      description={
        <>
          Your usage is above the free tier,{" "}
          <A href={`/${workspace().slug}/settings#billing`}>
            update your billing details
          </A>
          .<br />
          Note, you can continue using the Console for local stages.
          <br />
          Just make sure `sst dev` is running locally.
        </>
      }
    />
  );
}
