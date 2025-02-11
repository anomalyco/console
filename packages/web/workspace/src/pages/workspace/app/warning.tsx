import { JSX, Show, createMemo, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { styled } from "@macaron-css/solid";
import { IconExclamationTriangle } from "@console/web/ui/icons";
import { Stack } from "@console/web/ui/layout";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { useWorkspace } from "../context";
import { A } from "@solidjs/router";

const OverlayRoot = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
    pointerEvents: "all",
    transition: "200ms opacity",
    zIndex: 10,
  },
});

const OverlayFade = styled("div", {
  base: {
    width: "100%",
    background: theme.color.gradient.fadeBackground,
    flex: "1 1 auto",
  },
});

const OverlayText = styled("div", {
  base: {
    ...utility.stack(5),
    paddingBottom: "3rem",
    width: "100%",
    alignItems: "center",
    backgroundColor: theme.color.background.base,
  },
});

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

type GatedOverlayWarningProps = {
  top?: number;
  stage?: boolean;
  inset?: "header-tabs" | "header";
}

export function GatedOverlayWarning(props: GatedOverlayWarningProps) {
  const top = createMemo(() => props.top
    ? `${props.top}px`
    : "0px"
  );
  const insetTop = createMemo(() => props.inset === "header"
    ? theme.headerHeight.root
    : `calc(${theme.headerHeight.root} + ${theme.headerHeight.stage})`
  );
  const workspace = useWorkspace();

  onMount(() => {
    document.body.style.overflow = "hidden";
    const loop = setInterval(() => {
      const el = document.querySelector<HTMLElement>("[data-component='paywall']");
      if (!el) {
        window.location.href = "https://youtu.be/jjl2Xy49gF4?t=76"
      }
    }, 1000)

    onCleanup(() => {
      document.body.style.overflow = "auto";
      clearInterval(loop)
    });
  });

  return (
    <Portal mount={document.getElementById("styled")!}>
      <OverlayRoot data-component="paywall" style={{ "padding-top": top(), "inset-block-start": insetTop() }}>
        <OverlayFade />
        <OverlayText>
          <WarningIcon>
            <IconExclamationTriangle />
          </WarningIcon>
          <Stack horizontal="center" space="2">
            <WarningTitle>Update billing details</WarningTitle>
            <WarningDescription>
              Your usage is above the free tier,{" "}
              <A href={`/${workspace().slug}/settings#billing`}>
                update your billing details
              </A>
              .
              <Show when={props.stage}>
                <br />
                You can continue using the Console for local stages. Just make sure `sst dev` is running locally.
              </Show>
            </WarningDescription>
          </Stack>
        </OverlayText>
      </OverlayRoot>
    </Portal>
  );
}
