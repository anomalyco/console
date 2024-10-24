import { Show } from "solid-js";
import { styled } from "@macaron-css/solid";
import { Link } from "@solidjs/router";
import { Text } from "$/ui/text";
import { Stack, Fullscreen } from "$/ui/layout";
import { Header } from "./workspace/header";
import { theme } from "$/ui/theme";

const HomeLink = styled(Link, {
  base: {
    fontSize: theme.font.size.sm,
  },
});

const NotAllowedDesc = styled("div", {
  base: {
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.base,
  },
});

interface ErrorScreenProps {
  inset?: "none" | "header" | "header-tabs";
  message?: string;
  header?: boolean;
}
export function NotFound(props: ErrorScreenProps) {
  return (
    <>
      <Show when={props.header}>
        <Header />
      </Show>
      <Fullscreen
        inset={props.inset ? props.inset : props.header ? "header" : "none"}
      >
        <Stack space="2.5" horizontal="center">
          <Text size="lg">{props.message || "Page not found"}</Text>
          <HomeLink href="/">Go back home</HomeLink>
        </Stack>
      </Fullscreen>
    </>
  );
}

export function NotAllowed(props: ErrorScreenProps) {
  return (
    <>
      <Show when={props.header}>
        <Header />
      </Show>
      <Fullscreen
        inset={props.inset ? props.inset : props.header ? "header" : "none"}
      >
        <Stack space="2.5" horizontal="center">
          <Text size="lg">Access not allowed</Text>
          <NotAllowedDesc>
            You don't have access to this page,{" "}
            <HomeLink href="/">go back home</HomeLink>.
          </NotAllowedDesc>
        </Stack>
      </Fullscreen>
    </>
  );
}
