import { Show, createMemo, createSignal, Suspense } from "solid-js";
import { DateTime } from "luxon";
import { styled } from "@macaron-css/solid";
import { useApi, useWorkspace } from "../context";
import { utility } from "$/ui/utility";
import { Toggle } from "$/ui/switch";
import { IconLogosSlack, IconLogosGitHub } from "$/ui/icons/custom";
import { formatNumber } from "$/common/format";
import { useReplicache } from "$/providers/replicache";
import { PRICING_PLAN, PricingPlan, UsageStore } from "$/data/usage";
import { Header } from "../header";
import { SlackTeamStore, StripeStore, GithubOrgStore } from "$/data/app";
import { createEventListener } from "@solid-primitives/event-listener";
import { Alerts } from "./alerts";
import { useNavigate } from "@solidjs/router";
import { useAuth2 } from "$/providers/auth2";
import { AWS } from "./aws";
import { theme } from "$/ui/theme";
import { Stack, Row } from "$/ui/layout";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";

export const PANEL_CONTENT_SPACE = "10";
export const PANEL_HEADER_SPACE = "3";
const TIER_LABEL_SPACE = "2";

function calculateCost(units: number, pricingPlan: PricingPlan) {
  let cost = 0;

  for (let tier of pricingPlan) {
    if (units > tier.from) {
      if (units < tier.to) {
        cost += (units - tier.from) * tier.rate;
        break;
      } else {
        cost += (tier.to - tier.from) * tier.rate;
      }
    }
  }

  return cost === 0 ? "0" : cost.toFixed(2);
}

export const SettingsRoot = styled("div", {
  base: {
    paddingTop: 50,
    paddingBottom: 50,
    margin: "0 auto",
    width: theme.modalWidth.lg,
  },
});

export const NavIcon = styled("div", {
  base: {
    top: 2,
    position: "relative",
    opacity: theme.iconOpacity,
  },
});

export const Divider = styled("div", {
  base: {
    margin: `${theme.space[12]} 0`,
    width: "100%",
    height: 1,
    backgroundColor: theme.color.divider.base,
  },
});
const UsagePanel = styled("div", {
  base: {
    ...utility.row(0),
    flex: 1,
    width: "100%",
    justifyContent: "space-between",
    border: `1px solid ${theme.color.divider.base}`,
    borderRadius: theme.borderRadius,
  },
});

const UsageStat = styled("div", {
  base: {
    ...utility.stack(4),
    justifyContent: "center",
    borderRight: `1px solid ${theme.color.divider.base}`,
    padding: `${theme.space[6]} ${theme.space[6]} ${theme.space[6]}`,
  },
  variants: {
    stretch: {
      true: {
        flex: 1,
      },
      false: {
        flex: "0 0 auto",
      },
    },
  },
  defaultVariants: {
    stretch: false,
  },
});

const UsageTiers = styled("div", {
  base: {
    ...utility.stack(4),
    flex: "0 0 auto",
    justifyContent: "center",
    backgroundColor: theme.color.background.surface,
    padding: `${theme.space[6]} ${theme.space[6]} ${theme.space[6]}`,
  },
});

const UsageStatTier = styled("span", {
  base: {
    minWidth: 60,
    lineHeight: 1,
    fontSize: theme.font.size.mono_xs,
    fontFamily: theme.font.family.code,
    color: theme.color.text.secondary.surface,
  },
});

export function SettingsRoute() {
  const rep = useReplicache();
  const usages = UsageStore.list.watch(rep, () => []);
  const invocations = createMemo(() =>
    usages()
      .map((usage) => usage.invocations)
      .reduce((a, b) => a + b, 0),
  );
  const api = useApi();
  console.log("usages", usages().length);
  const auth = useAuth2();
  const workspace = useWorkspace();
  const cycle = createMemo(() => {
    const data = usages();
    const start = data[0] ? DateTime.fromSQL(data[0].day) : DateTime.now();
    return {
      start: start.startOf("month").toFormat("LLL d"),
      end: start.endOf("month").toFormat("LLL d"),
    };
  });

  let portalLink: Promise<Response> | undefined;
  let checkoutLink: Promise<Response> | undefined;

  function generatePortalLink() {
    return fetch(import.meta.env.VITE_API_URL + "/billing/portal", {
      method: "POST",
      body: JSON.stringify({ return_url: window.location.href }),
      headers: {
        "x-sst-workspace": workspace().id,
        Authorization: rep().auth,
      },
    });
  }
  function generateCheckoutLink() {
    return fetch(import.meta.env.VITE_API_URL + "/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ return_url: window.location.href }),
      headers: {
        "x-sst-workspace": workspace().id,
        Authorization: rep().auth,
      },
    });
  }

  function handleHoverManageSubscription() {
    if (portalLink) return;
    console.log("generate portal link");
    portalLink = generatePortalLink();
  }

  function handleHoverSubscribe() {
    if (checkoutLink) return;
    console.log("generate checkout link");
    checkoutLink = generateCheckoutLink();
  }

  async function handleClickManageSubscription(e: MouseEvent) {
    e.stopPropagation();
    const response = await (portalLink || generatePortalLink());
    const result = await response.json();
    window.location.href = result.url;
  }

  async function handleClickSubscribe(e: MouseEvent) {
    e.stopPropagation();
    const response = await (checkoutLink || generateCheckoutLink());
    const result = await response.json();
    console.log(result.url);
    window.location.href = result.url;
  }

  const stripe = StripeStore.get.watch(rep, () => []);
  const nav = useNavigate();

  return (
    <Suspense>
      <Header />
      <SettingsRoot>
        <Stack space={PANEL_HEADER_SPACE}>
          <Text size="xl" weight="medium">
            Workspace
          </Text>
          <Text size="base" color="dimmed">
            View and manage your workspace settings
          </Text>
        </Stack>
        <Divider />
        <Alerts />
        <Divider />
        <Stack space={PANEL_CONTENT_SPACE}>
          <Stack space={PANEL_HEADER_SPACE}>
            <Text size="lg" weight="medium">
              Usage
            </Text>
            <Text size="sm" color="dimmed">
              Usage for the current billing period
            </Text>
          </Stack>
          <Stack space="3.5">
            <UsagePanel>
              <UsageStat stretch>
                <Text code uppercase size="mono_xs" color="dimmed">
                  Invocations
                </Text>
                <Text code size="xl">
                  {invocations()}
                </Text>
              </UsageStat>
              <UsageStat stretch>
                <Text code uppercase size="mono_xs" color="dimmed">
                  Current Cost
                </Text>
                <Row space="0.5" vertical="center">
                  <Text size="sm" color="secondary">
                    $
                  </Text>
                  <Text code weight="medium" size="xl">
                    {calculateCost(invocations(), PRICING_PLAN)}
                  </Text>
                </Row>
              </UsageStat>
              <UsageTiers>
                <Stack space="1">
                  <Row space={TIER_LABEL_SPACE}>
                    <UsageStatTier>
                      {formatNumber(PRICING_PLAN[0].from)} -{" "}
                      {formatNumber(PRICING_PLAN[0].to)}
                    </UsageStatTier>
                    <Text color="dimmed" on="surface" size="xs">
                      →
                    </Text>
                    <Text size="mono_xs" on="surface" color="secondary">
                      Free
                    </Text>
                  </Row>
                  <Row space={TIER_LABEL_SPACE}>
                    <UsageStatTier>
                      {formatNumber(PRICING_PLAN[1].from)} -{" "}
                      {formatNumber(PRICING_PLAN[1].to)}
                    </UsageStatTier>
                    <Text color="dimmed" on="surface" size="xs">
                      →
                    </Text>
                    <Text code size="mono_xs" on="surface" color="secondary">
                      ${PRICING_PLAN[1].rate} per
                    </Text>
                  </Row>
                  <Row space={TIER_LABEL_SPACE}>
                    <UsageStatTier>
                      {formatNumber(PRICING_PLAN[2].from)} +
                    </UsageStatTier>
                    <Text color="dimmed" on="surface" size="xs">
                      →
                    </Text>
                    <Text code size="mono_xs" on="surface" color="secondary">
                      ${PRICING_PLAN[2].rate} per
                    </Text>
                  </Row>
                </Stack>
              </UsageTiers>
            </UsagePanel>
            <Text size="sm" color="secondary">
              Calculated for the period of {cycle().start} — {cycle().end}.{" "}
              <a href="https://docs.sst.dev/console#pricing" target="_blank">
                Learn more
              </a>{" "}
              or <a href="mailto:hello@sst.dev">contact us</a> for volume
              pricing.
            </Text>
          </Stack>
        </Stack>
        <Divider />
        <Stack space={PANEL_CONTENT_SPACE} horizontal="start" id="billing">
          <Stack space={PANEL_HEADER_SPACE}>
            <Text size="lg" weight="medium">
              Billing
            </Text>
            <Text size="sm" color="dimmed">
              Manage your billing details, and download your invoices
            </Text>
          </Stack>
          <Stack space="3.5" horizontal="start">
            <Show when={stripe()?.subscriptionID}>
              <Button
                color="secondary"
                onMouseEnter={handleHoverManageSubscription}
                onClick={handleClickManageSubscription}
              >
                Manage Billing Details
              </Button>
              <Show when={stripe().standing === "overdue"}>
                <Text color="danger" size="sm">
                  We were unable to charge your card. Please update your billing
                  details.
                </Text>
              </Show>
            </Show>
            <Show when={!stripe()?.subscriptionID}>
              <Button
                color="primary"
                onClick={handleClickSubscribe}
                onMouseEnter={handleHoverSubscribe}
              >
                Add Billing Details
              </Button>
              <Show when={invocations() > PRICING_PLAN[0].to}>
                <Text color="danger" size="sm">
                  Your current usage is above the free tier. Please add your
                  billing details.
                </Text>
              </Show>
            </Show>
          </Stack>
        </Stack>
        <Divider />
        <AWS />
        <Integrations />
        <Divider />
        <Stack space={PANEL_CONTENT_SPACE} horizontal="start" id="billing">
          <Stack space={PANEL_HEADER_SPACE}>
            <Text size="lg" weight="medium" color="danger">
              Remove Workspace
            </Text>
            <Text size="sm" color="danger">
              Remove all your data and disconnect your AWS accounts
            </Text>
          </Stack>
          <Stack space="3.5" horizontal="start">
            <Button
              color="danger"
              onClick={async () => {
                if (
                  !confirm(
                    "Are you sure you want to remove this workspace?\n\nYou cannot undo this.",
                  )
                )
                  return;

                await fetch(import.meta.env.VITE_API_URL + "/workspace/" + workspace().id, {
                  method: "DELETE",
                  headers: {
                    authorization: `Bearer ${auth.current.token}`,
                  },
                });
                await auth.refresh();
                nav("/");
              }}
            >
              Remove Workspace
            </Button>
          </Stack>
        </Stack>
      </SettingsRoot>
    </Suspense>
  );
}

function Integrations() {
  const rep = useReplicache();
  const workspace = useWorkspace();
  const auth = useAuth2();
  const slackTeam = SlackTeamStore.all.watch(
    rep,
    () => [],
    (all) => all.at(0),
  );
  const githubOrg = GithubOrgStore.all.watch(
    rep,
    () => [],
    (orgs) => orgs.find((org) => !org.time.disconnected),
  );

  const [overrideSlack, setOverrideSlack] = createSignal(false);
  const [overrideGithub, setOverrideGithub] = createSignal(false);

  createEventListener(
    () => window,
    "message",
    (e) => {
      if (e.data === "slack.success") setOverrideSlack(true);
      if (e.data === "github.success") setOverrideGithub(true);
    },
  );

  return (
    <Show when={githubOrg.ready && slackTeam.ready}>
      <Divider />
      <Stack space={PANEL_CONTENT_SPACE}>
        <Stack space={PANEL_HEADER_SPACE}>
          <Text size="lg" weight="medium">
            Integrations
          </Text>
          <Text size="sm" color="dimmed">
            Connect your workspace with the services you use
          </Text>
        </Stack>
        <Row space="3.5" horizontal="between" vertical="center" id="slack">
          <Row space="3" vertical="center">
            <IconLogosSlack width="32" height="32" />
            <Stack space="1.5">
              <Text weight="medium">Slack</Text>
              <Show
                when={slackTeam()}
                fallback={
                  <Text size="sm" color="dimmed">
                    Connect to your Slack workspace
                  </Text>
                }
              >
                <Text size="sm" color="dimmed">
                  Connected to{" "}
                  <Text color="dimmed" size="sm" weight="medium">
                    {slackTeam()?.teamName}
                  </Text>
                </Text>
              </Show>
            </Stack>
          </Row>
          <form
            action={import.meta.env.VITE_API_URL + "/slack/authorize"}
            method="get"
            target="newWindow"
          >
            <Toggle
              checked={Boolean(slackTeam()) || overrideSlack()}
              onClick={(e) => {
                if (slackTeam()) {
                  rep().mutate.slack_disconnect(slackTeam()!.id);
                  setOverrideSlack(false);
                  return;
                }
                e.currentTarget.closest("form")?.submit();
              }}
            />
            <input
              type="hidden"
              name="authorization"
              value={"Bearer " + auth.current.token}
            />
            <input type="hidden" name="workspaceID" value={workspace().id} />
          </form>
        </Row>
        <Row space="3.5" horizontal="between" vertical="center" id="github">
          <Row space="3" vertical="center">
            <IconLogosGitHub width="32" height="32" />
            <Stack space="1.5">
              <Text weight="medium">GitHub</Text>
              <Show
                when={githubOrg()}
                fallback={
                  <Text size="sm" color="dimmed">
                    Connect to your GitHub organization
                  </Text>
                }
              >
                <Text size="sm" color="dimmed">
                  Connected to{" "}
                  <Text color="dimmed" size="sm" weight="medium">
                    {githubOrg()?.login}
                  </Text>
                </Text>
              </Show>
            </Stack>
          </Row>
          <form
            action={import.meta.env.VITE_API_URL + "/github/connect"}
            method="get"
            target="newWindow"
          >
            <Toggle
              checked={Boolean(githubOrg()) || overrideGithub()}
              onClick={(e) => {
                if (githubOrg()) {
                  rep().mutate.github_disconnect(githubOrg()!.id);
                  setOverrideGithub(false);
                  return;
                }
                e.currentTarget.closest("form")?.submit();
              }}
            />
            <input type="hidden" name="provider" value="github" />
            <input type="hidden" name="workspaceID" value={workspace().id} />
            <input type="hidden" name="token" value={auth.current.token} />
          </form>
        </Row>
      </Stack>
    </Show>
  );
}
