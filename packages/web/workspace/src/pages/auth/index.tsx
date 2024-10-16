import {
  Row,
  Text,
  Stack,
  Input,
  Button,
  FormField,
  Fullscreen,
  theme,
  utility,
} from "$/ui";
import { DateTime } from "luxon";
import { IconApp } from "$/ui/icons/custom";
import { styled } from "@macaron-css/solid";
import { IconChevronRight } from "$/ui/icons";
import { Navigate, Route, Routes, useSearchParams } from "@solidjs/router";
import { For, Show, createSignal, onMount } from "solid-js";
import Botpoison from "@botpoison/browser";
import { createSingleSelectListState } from "@kobalte/core";
import { NotFound } from "../not-found";

const Root = styled("div", {
  base: {
    alignItems: "center",
    width: 320,
  },
  variants: {
    form: {
      email: {
        ...utility.stack(5),
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
        paddingTop: theme.space[5],
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

const AnnouncementLinkIcon = styled("span", {
  base: {
    top: 2,
    paddingLeft: 1,
    position: "relative",
    opacity: theme.iconOpacity,
  },
});

export function Auth() {
  return (
    <Fullscreen>
      <Routes>
        <Route path="email" component={Email} />
        <Route path="code" component={Code} />
        <Route path="" element={<Navigate href="email" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Fullscreen>
  );
}

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
            <li>View logs and manage all your apps</li>
            <li>Get alerts for any issues in your apps</li>
            <li>
              <a href="https://docs.sst.dev/console" target="_blank">
                Learn more
              </a>{" "}
              about how the console works
            </li>
          </NewConsoleTips>
        </Stack>
      </Stack>
      <Form
        method="get"
        action={import.meta.env.VITE_AUTH_URL + "email/authorize"}
        onSubmit={async (e) => {
          setSubmitting(true);
          e.preventDefault();
          const form = e.currentTarget;
          await ready;
          form.submit();
        }}
      >
        <FormField>
          <Input autofocus type="email" name="email" placeholder="Email" />
        </FormField>
        <Show when={search.impersonate}>
          <FormField>
            <Input
              autofocus
              type="email"
              name="impersonate"
              placeholder="Impersonate"
            />
          </FormField>
        </Show>
        <input type="hidden" name="client_id" value="solid" />
        <input
          type="hidden"
          name="redirect_uri"
          value={location.origin + "/"}
        />
        <input type="hidden" name="response_type" value="token" />
        <input type="hidden" name="provider" value="email" />
        <input type="hidden" name="challenge" value={challenge()} />
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

  function submit() {
    setDisabled(true);
    const code = [...document.querySelectorAll("[data-element=code]")]
      .map((el) => (el as HTMLInputElement).value)
      .join("");
    location.href =
      import.meta.env.VITE_AUTH_URL +
      "email/callback?" +
      new URLSearchParams({
        code,
      }).toString();
  }

  function inputs() {
    return [
      ...document.querySelectorAll<HTMLInputElement>("[data-element=code]"),
    ];
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
      <Form method="get" action={import.meta.env.VITE_AUTH_URL + "/authorize"}>
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
                  submit();
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
                    return;
                  }
                }}
                onInput={(e) => {
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

                  if (!next) submit();
                }}
              />
            )}
          </For>
        </Row>
      </Form>
    </Root>
  );
}
