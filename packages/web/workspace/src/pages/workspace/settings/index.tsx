import { Show, createMemo, createSignal, Suspense } from "solid-js";
import { DateTime } from "luxon";
import { styled } from "@macaron-css/solid";
import { useWorkspace } from "../context";
import { utility } from "@console/web/ui/utility";
import { Toggle } from "@console/web/ui/switch";
import { IconLogosSlack, IconLogosGitHub } from "@console/web/ui/icons/custom";
import { formatNumber } from "@console/web/common/format";
import {
  createSubscription,
  useReplicache,
} from "@console/web/providers/replicache";
import {
  INVOCATIONS_PRICING_PLAN,
  RESOURCES_PRICING_PLAN,
  PricingPlan,
  InvocationsUsageStore,
  ResourcesUsageStore,
} from "@console/web/data/usage";
import { WorkspaceStore } from "@console/web/data/workspace";
import { Header } from "../header";
import {
  SlackTeamStore,
  StripeStore,
  GithubOrgStore,
} from "@console/web/data/app";
import { createEventListener } from "@solid-primitives/event-listener";
import { Alerts } from "./alerts";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "@console/web/providers/auth";
import { AWS } from "./aws";
import { theme } from "@console/web/ui/theme";
import { Stack, Row } from "@console/web/ui/layout";
import { Text } from "@console/web/ui/text";
import { Button } from "@console/web/ui/button";

export const PANEL_CONTENT_SPACE = "10";
export const PANEL_HEADER_SPACE = "3";
const TIER_LABEL_SPACE = "2";

function calculateCost(
  units: number,
  pricingPlan: PricingPlan,
  discount?: number,
) {
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

  cost = discount ? cost * (discount / 100) : cost;

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
  variants: {
    padding: {
      true: {
        padding: `${theme.space[6]} ${theme.space[6]} ${theme.space[6]}`,
      },
      false: {
        padding: `0 ${theme.space[6]}`,
      },
    },
  },
  defaultVariants: {
    padding: true,
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

const UsagePlanCopy = styled("p", {
  base: {
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.base,
    lineHeight: theme.font.lineHeight,
  },
});

export function SettingsRoute() {
  const rep = useReplicache();
  const invocationsUsages = InvocationsUsageStore.list.watch(rep, () => []);
  const resourcesUsages = ResourcesUsageStore.list.watch(rep, () => []);
  const invocations = createMemo(() =>
    invocationsUsages()
      .map((usage) => usage.invocations)
      .reduce((a, b) => a + b, 0),
  );
  const resources = createMemo(() =>
    resourcesUsages()
      .map((usage) => usage.count)
      .reduce((a, b) => a + b, 0),
  );
  const resourceStages = createMemo(() => resourcesUsages().length);
  const auth = useAuth();
  const nav = useNavigate();
  const workspace = useWorkspace();
  const cycle = createMemo(() => {
    const data = invocationsUsages();
    const start = data[0] ? DateTime.fromSQL(data[0].day) : DateTime.now();
    return {
      start: start.startOf("month").toFormat("LLL d"),
      end: start.endOf("month").toFormat("LLL d"),
    };
  });
  const stripe = StripeStore.get.watch(rep, () => []);

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

  console.log(WorkspaceStore);
  const workspaceInfo = createSubscription(() => {
    const workspaceID = useWorkspace();
    return (tx) => WorkspaceStore.get(tx, workspaceID().id);
  });

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
          <Stack space="7">
            <Show when={stripe()?.price === "invocations"}>
              <Stack space="2">
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
                        {calculateCost(
                          invocations(),
                          INVOCATIONS_PRICING_PLAN,
                          stripe().discount,
                        )}
                      </Text>
                    </Row>
                  </UsageStat>
                  <UsageTiers>
                    <Stack space="1">
                      <Row space={TIER_LABEL_SPACE}>
                        <UsageStatTier>
                          {formatNumber(INVOCATIONS_PRICING_PLAN[0].from)} -{" "}
                          {formatNumber(INVOCATIONS_PRICING_PLAN[0].to)}
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
                          {formatNumber(INVOCATIONS_PRICING_PLAN[1].from)} -{" "}
                          {formatNumber(INVOCATIONS_PRICING_PLAN[1].to)}
                        </UsageStatTier>
                        <Text color="dimmed" on="surface" size="xs">
                          →
                        </Text>
                        <Text
                          code
                          size="mono_xs"
                          on="surface"
                          color="secondary"
                        >
                          ${INVOCATIONS_PRICING_PLAN[1].rate} per
                        </Text>
                      </Row>
                      <Row space={TIER_LABEL_SPACE}>
                        <UsageStatTier>
                          {formatNumber(INVOCATIONS_PRICING_PLAN[2].from)} +
                        </UsageStatTier>
                        <Text color="dimmed" on="surface" size="xs">
                          →
                        </Text>
                        <Text
                          code
                          size="mono_xs"
                          on="surface"
                          color="secondary"
                        >
                          ${INVOCATIONS_PRICING_PLAN[2].rate} per
                        </Text>
                      </Row>
                    </Stack>
                  </UsageTiers>
                </UsagePanel>
                <UsagePlanCopy>
                  Below is the new pricing plan. If you'd like to switch, you
                  can unsubscribe from the current plan and resubscribe.{" "}
                  <a
                    href="http://sst.dev/blog/console-pricing-update"
                    target="_blank"
                  >
                    Learn more
                  </a>
                  .
                </UsagePlanCopy>
              </Stack>
            </Show>
            <Stack space="2">
              <UsagePanel>
                <UsageStat stretch>
                  <Text code uppercase size="mono_xs" color="dimmed">
                    Active Resources
                  </Text>
                  <Text code size="xl">
                    {resources()}
                  </Text>
                </UsageStat>
                <UsageStat stretch>
                  <Text code uppercase size="mono_xs" color="dimmed">
                    {stripe()?.price === "invocations"
                      ? "New Cost"
                      : "Current Cost"}
                  </Text>
                  <Row space="0.5" vertical="center">
                    <Text size="sm" color="secondary">
                      $
                    </Text>
                    <Text code weight="medium" size="xl">
                      {calculateCost(
                        resources(),
                        RESOURCES_PRICING_PLAN,
                        stripe()?.discount,
                      )}
                    </Text>
                  </Row>
                </UsageStat>
                <UsageTiers padding={false}>
                  <Stack space="3">
                    <Stack space="0.5">
                      <Row space={TIER_LABEL_SPACE}>
                        <UsageStatTier>
                          {"<= "}
                          {formatNumber(RESOURCES_PRICING_PLAN[0].to)}
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
                          {formatNumber(RESOURCES_PRICING_PLAN[1].from)} -{" "}
                          {formatNumber(RESOURCES_PRICING_PLAN[1].to)}
                        </UsageStatTier>
                        <Text color="dimmed" on="surface" size="xs">
                          →
                        </Text>
                        <Text code size="mono_xs" on="surface" color="secondary">
                          ${RESOURCES_PRICING_PLAN[1].rate} per
                        </Text>
                      </Row>
                      <Row space={TIER_LABEL_SPACE}>
                        <UsageStatTier>
                          {formatNumber(RESOURCES_PRICING_PLAN[2].from)} +
                        </UsageStatTier>
                        <Text color="dimmed" on="surface" size="xs">
                          →
                        </Text>
                        <Text code size="mono_xs" on="surface" color="secondary">
                          ${RESOURCES_PRICING_PLAN[2].rate} per
                        </Text>
                      </Row>
                    </Stack>
                    <Show when={stripe()?.discount}>
                      <Text code size="mono_xs" on="surface" color="secondary">
                        {stripe()?.discount}% off for 12 months
                      </Text>
                    </Show>
                  </Stack>
                </UsageTiers>
              </UsagePanel>
              <UsagePlanCopy>
                Active resources from{" "}
                {resourceStages() === 1
                  ? "1 updated stage"
                  : `${resourceStages()} updated stages`}{" "}
                during {cycle().start} — {cycle().end}. Feel free to{" "}
                <a href="mailto:hello@sst.dev">contact us</a> if you have any
                questions.
              </UsagePlanCopy>
            </Stack>
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
              <Show when={resources() > RESOURCES_PRICING_PLAN[0].to}>
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
        <Divider />
        <Row space="3.5" horizontal="between" vertical="center" id="issues">
          <Stack space={PANEL_HEADER_SPACE}>
            <Text size="lg" weight="medium">
              Issues
            </Text>
            <Text size="sm" color="dimmed">
              Process your application logs for issues
            </Text>
          </Stack>
          <Toggle
            checked={workspaceInfo.value?.settingIssue}
            onClick={() => {
              rep().mutate.workspace_setting_issue({
                workspaceID: workspaceInfo.value?.id!,
                value: !workspaceInfo.value?.settingIssue,
              });
            }}
          />
        </Row>
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

                await fetch(
                  import.meta.env.VITE_API_URL + "/workspace/" + workspace().id,
                  {
                    method: "DELETE",
                    headers: {
                      authorization: `Bearer ${auth.current.access}`,
                    },
                  },
                );
                location.href = "/";
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
  const auth = useAuth();
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
              value={"Bearer " + auth.current.access}
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
            <input type="hidden" name="token" value={auth.current.access} />
          </form>
        </Row>
      </Stack>
    </Show>
  );
}
