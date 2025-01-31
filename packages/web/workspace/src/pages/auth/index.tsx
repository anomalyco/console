import { DateTime } from "luxon";
import { IconApp } from "@console/web/ui/icons/custom";
import { styled } from "@macaron-css/solid";
import { IconChevronRight } from "@console/web/ui/icons";
import {
  Navigate,
  Route,
  useSearchParams,
} from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import Botpoison from "@botpoison/browser";
import { NotFound } from "../not-found";
import { FormField, Input } from "@console/web/ui/form";
import { Fullscreen, Stack, Row } from "@console/web/ui/layout";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { Text } from "@console/web/ui/text";
import { Button } from "@console/web/ui/button";

const Root = styled("div", {
  base: {
    alignItems: "center",
    width: 320,
  },
  variants: {
    form: {
      email: {
        ...utility.stack(6),
      },
      code: {
        ...utility.stack(8),
      },
    },
  },
});

const Form = styled("form", {
  base: {
    width: 320,
    ...utility.stack(5),
    selectors: {
      [`${Root.selector({ form: "email" })} &`]: {
        paddingTop: theme.space[7],
        borderTop: `1px solid ${theme.color.divider.base}`,
      },
      [`${Root.selector({ form: "code" })} &`]: {},
    },
  },
});

const LoginIcon = styled("div", {
  base: {
    width: 42,
    height: 42,
    color: theme.color.accent,
  },
});

const NewConsoleTips = styled("ul", {
  base: {
    ...utility.stack(2.5),
    width: "100%",
    padding: `${theme.space[4]} ${theme.space[2]} ${theme.space[4]} 30px`,
    listStyle: "circle",
    lineHeight: "normal",
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
  },
});

const Announcement = styled("div", {
  base: {
    backgroundColor: theme.color.background.blue,
    borderRadius: theme.borderRadius,
    width: "100%",
    paddingInline: theme.space[1],
    paddingBlock: theme.space[3],
    textAlign: "center",
    lineHeight: 1.4,
  },
});

const LegalLinks = styled("div", {
  base: {
    ...utility.row(0),
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const LegalLink = styled("a", {
  base: {
    fontSize: theme.font.size.xs,
    lineHeight: "normal",
    color: theme.color.text.dimmed.base,
  },
});

const AnnouncementLinkIcon = styled("span", {
  base: {
    top: 2,
    paddingLeft: 1,
    position: "relative",
    opacity: theme.iconOpacity,
  },
});

export function Email() {
  const botpoison = new Botpoison({
    publicKey: "pk_646d2d37-ab95-43d1-ae96-3ad59616e362",
  });
  const [search] = useSearchParams();

  const [challenge, setChallenge] = createSignal<string>();
  const [submitting, setSubmitting] = createSignal<boolean>();
  const ready = botpoison
    .challenge()
    .then((value) => setChallenge(value.solution));

  return (
    <Root form="email">
      <Stack horizontal="center" space="5" style={{ width: "100%" }}>
        <LoginIcon>
          <IconApp />
        </LoginIcon>
        <Stack horizontal="center" space="4" style={{ width: "100%" }}>
          <Stack horizontal="center" space="2">
            <Text size="lg" weight="medium">
              Welcome to the SST Console
            </Text>
            <Text color="secondary" on="base" center>
              Sign in with your email to get started
            </Text>
          </Stack>
          <Show when={DateTime.now() < DateTime.fromISO("2024-03-28")}>
            <Announcement>
              <Text size="sm" on="surface" color="secondary">
                {" "}
                <a href="https://forms.gle/iBVtq6zi6biAbZKy7" target="_blank">
                  Host the Console in your AWS account
                  <AnnouncementLinkIcon>
                    <IconChevronRight width="13" height="13" />
                  </AnnouncementLinkIcon>
                </a>
              </Text>
            </Announcement>
          </Show>
          <NewConsoleTips>
            <li>Git push to deploy your apps</li>
            <li>Get alerts for any issues in your apps</li>
            <li>
              <a href="https://sst.dev/docs/console" target="_blank">
                Learn more
              </a>{" "}
              about how the console works
            </li>
          </NewConsoleTips>
          <LegalLinks>
            <LegalLink
              target="_blank"
              href="https://sst.dev/legal/privacy-policy"
            >
              Privacy Policy
            </LegalLink>
            <LegalLink
              target="_blank"
              href="https://sst.dev/legal/terms-of-service"
            >
              Terms of Service
            </LegalLink>
          </LegalLinks>
        </Stack>
      </Stack>
      <Form
        method="post"
        action={import.meta.env.VITE_AUTH_URL + "/email/authorize"}
        onSubmit={async () => {
          setSubmitting(true);
        }}
      >
        <FormField>
          <Input autofocus type="email" name="email" placeholder="Email" />
        </FormField>
        <Show when={search.impersonate}>
          <FormField>
            <Input
              autofocus
              name="impersonate"
              placeholder="Impersonate"
            />
          </FormField>
        </Show>
        <input type="hidden" name="action" value="request" />
        <Stack space="3">
          <Button type="submit" disabled={submitting()}>
            {submitting() ? "Submitting" : "Continue"}
          </Button>
          <Text center size="sm" color="dimmed">
            We'll send a pin code to your email
          </Text>
        </Stack>
      </Form>
    </Root>
  );
}

export function Code() {
  const [disabled, setDisabled] = createSignal(false);

  function inputs() {
    return [
      ...document.querySelectorAll<HTMLInputElement>("[data-element=code]"),
    ];
  }

  function setValue(value: string) {
    const element = document.querySelector<HTMLFormElement>("input[name=code]")
    element!.value = value;
  }

  return (
    <Root form="code">
      <Stack horizontal="center" space="5">
        <LoginIcon>
          <IconApp />
        </LoginIcon>
        <Stack horizontal="center" space="2">
          <Text size="lg" weight="medium">
            Let's verify your email
          </Text>
          <Text color="secondary" on="base" center>
            Check your inbox for the code we sent you
          </Text>
        </Stack>
      </Stack>
      <Form
        onSubmit={async (e) => {
          setDisabled(true)
        }}
        method="post" action={import.meta.env.VITE_AUTH_URL + "/email/authorize"}>
        <Row horizontal="between">
          <For each={Array(6).fill(0)}>
            {() => (
              <Input
                style={{
                  width: "40px",
                  "text-align": "center",
                  "font-family": `${theme.font.family.code}`,
                }}
                data-element="code"
                maxLength={1}
                inputmode="numeric"
                autofocus
                disabled={disabled()}
                type="text"
                onPaste={(e) => {
                  const code = e.clipboardData?.getData("text/plain")?.trim();
                  if (!code) return;
                  const i = inputs();
                  if (code.length !== i.length) return;
                  i.forEach((item, index) => {
                    item.value = code[index];
                  });
                  e.preventDefault();
                  setValue(code);
                  e.currentTarget.closest("form")?.submit();
                }}
                onFocus={(e) => {
                  e.currentTarget.select();
                }}
                onKeyDown={(e) => {
                  if (!e.currentTarget.value && e.key === "Backspace") {
                    e.preventDefault();
                    const previous =
                      e.currentTarget.parentNode?.parentNode?.previousSibling
                        ?.firstChild?.firstChild;
                    if (previous instanceof HTMLInputElement) {
                      previous.focus();
                    }
                  }
                }}
                onInput={(e) => {
                  const code = [...document.querySelectorAll("[data-element=code]")]
                    .map((el) => (el as HTMLInputElement).value)
                    .join("");
                  setValue(code);
                  const all = inputs();
                  const index = all.indexOf(e.currentTarget);
                  if (!e.currentTarget.value) {
                    const previous = all[index - 1];
                    if (previous) {
                      previous.focus();
                    }
                    return;
                  }

                  const next = all[index + 1];
                  if (next) {
                    next.focus();
                    next.select();
                    return;
                  }

                  e.currentTarget.closest("form")?.submit();
                }}
              />
            )}
          </For>
        </Row>
        <input type="hidden" name="action" value="verify" />
        <input type="hidden" name="code" value="" />
      </Form>
    </Root>
  );
}

export const Auth = (
  <Route component={Fullscreen}>
    <Route path="email" component={Email} />
    <Route path="code" component={Code} />
    <Route path="/" component={() => <Navigate href="email" />} />
    <Route path="*" component={() => <NotFound />} />
  </Route>
);
