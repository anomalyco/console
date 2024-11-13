import { DateTime } from "luxon";
import { AppStore, RunStore, RepoFromApp, StateUpdateStore } from "$/data/app";
import { UserStore } from "$/data/user";
import { AccountStore } from "$/data/aws";
import { ActiveStages } from "$/data/stage";
import { createSubscription, useReplicache } from "$/providers/replicache";
import { Fullscreen, Row, Stack } from "$/ui/layout";
import { Dropdown } from "$/ui/dropdown";
import {
  IconChevronRight,
  IconEllipsisVertical,
  IconExclamationTriangle,
} from "$/ui/icons";
import { AvatarInitialsIcon } from "$/ui/avatar-icon";
import { Syncing } from "$/ui/loader";
import type { App, Stage } from "@console/core/app";
import {
  IconApp,
  IconCommit,
  IconGitHub,
  IconArrowPathSpin,
} from "$/ui/icons/custom";
import { styled } from "@macaron-css/solid";
import { Link, useNavigate, useSearchParams } from "@solidjs/router";
import { For, Match, Show, Switch, Suspense, createEffect, createMemo } from "solid-js";
import { Header } from "./header";
import { useLocalContext } from "$/providers/local";
import { filter, flatMap, groupBy, map, pipe, sortBy, entries } from "remeda";
import { User } from "@console/core/user";
import { useAuth2 } from "$/providers/auth2";
import { parseTime, formatSinceTime, formatCommit } from "$/common/format";
import { githubCommit, githubRepo } from "$/common/url-builder";
import { TextButton } from "$/ui/button";
import { Tag } from "$/ui/tag";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Text } from "$/ui/text";
import { Button, ChevronLink } from "$/ui/button";

const OVERFLOW_APPS_COUNT = 9;
const OVERFLOW_APPS_DISPLAY = 6;
const OVERFLOW_USERS_COUNT = 7;
const OVERFLOW_USERS_DISPLAY = 5;

const Root = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const BlockLink = styled(Link, {
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});

const Announcement = styled("div", {
  base: {
    backgroundColor: theme.color.background.surface,
    padding: theme.space[3],
    textAlign: "center",
  },
});

const AnnouncementTag = styled("span", {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.secondary.surface,
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

const PageHeader = styled("div", {
  base: {
    ...utility.stack(0),
    height: 42,
    justifyContent: "space-between",
  },
});

const Col = styled("div", {
  base: {
    ...utility.stack(4),
    width: `calc(50% - ${theme.space[4]} / 2)`,
  },
});

const Card = styled("div", {
  base: {
    borderRadius: theme.borderRadius,
    border: `1px solid ${theme.color.divider.base}`,
  },
  variants: {
    empty: {
      true: {
        height: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    },
  },
});

const CardHeader = styled("div", {
  base: {
    ...utility.row(3),
    position: "relative",
    height: 54,
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${theme.space[4]}`,
    borderBottom: `1px solid ${theme.color.divider.base}`,
  },
});

const CardTitle = styled(Link, {
  base: {
    ...utility.row(2),
    zIndex: 2,
    overflow: "hidden",
    alignItems: "center",
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.medium,
    color: theme.color.text.primary.base,
    lineHeight: "normal",
    transition: `color ${theme.colorFadeDuration} ease-out`,
  },
});

const CardTitleErrorLink = styled(Link, {
  base: {
    zIndex: 2,
  },
});

const CardTitleTeam = styled("p", {
  base: {
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.medium,
    color: theme.color.text.primary.base,
    lineHeight: "normal",
  },
});

const CardTitleTeamCount = styled("p", {
  base: {
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.dimmed.base,
    lineHeight: "normal",
  },
});

const CardTitleIcon = styled("span", {
  base: {
    lineHeight: 0,
    opacity: theme.iconOpacity,
    color: theme.color.text.primary.base,
  },
});

const CardTitleText = styled("span", {
  base: {
    ...utility.text.line,
  },
});

const CardTitleRightCol = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
  },
});

const CardTitleStatusLink = styled(Link, {
  base: {
    zIndex: 2,
  },
});

const RepoLink = styled("a", {
  base: {
    ...utility.row(0),
    gap: 4,
    height: 26,
    zIndex: 2,
    padding: "0 9px",
    alignItems: "center",
    color: theme.color.text.secondary.surface,
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    ":hover": {
      color: theme.color.text.primary.surface,
    },
  },
});

const RepoLinkCopy = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.sm,
    lineHeight: "normal",
  },
});

const RepoLinkIcon = styled("span", {
  base: {
    lineHeight: 0,
    opacity: theme.iconOpacity,
    color: theme.color.text.secondary.surface,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${RepoLink}:hover &`]: {
        color: theme.color.text.primary.surface,
      },
    },
  },
});

const CardStatus = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: theme.space[4],
    borderTop: `1px solid ${theme.color.divider.base}`,
    selectors: {
      "&:first-child": {
        borderTop: "none",
      },
    },
  },
});

const CardStatusIcon = styled("div", {
  base: {
    width: 16,
    height: 16,
  },
  variants: {
    status: {
      error: {
        color: `hsla(${theme.color.base.red}, 100%)`,
      },
      info: {
        color: theme.color.icon.dimmed,
      },
    },
  },
});

const CardOverflowRow = styled("div", {
  base: {
    textAlign: "center",
    padding: `${theme.space[3]} ${theme.space[4]}`,
    borderTop: `1px solid ${theme.color.divider.base}`,
  },
});

function sortUsers(users: User.Info[], selfEmail: string): User.Info[] {
  return sortBy(
    users,
    (user) => (user.email === selfEmail ? 0 : 1), // Your own user
    (user) => (!user.timeSeen ? 0 : 1), // Invites
    (user) => user.email.length, // Sort by length
  );
}

function splitCols(array: App.Info[]) {
  if (array.length === 0) {
    return [[], []];
  } else if (array.length === 1) {
    return [array, []];
  }

  var col1 = [];
  var col2 = [];

  for (var i = 0; i < array.length; i++) {
    // Leave an empty slot for the users card
    if (i === 0 || i % 2 !== 0) {
      col1.push(array[i]);
    } else {
      col2.push(array[i]);
    }
  }

  return [col1, col2];
}

export function OverviewNext() {
  const rep = useReplicache();
  const [query, setQuery] = useSearchParams<{
    force?: string;
    users?: string;
    accounts?: string;
  }>();
  const accounts = AccountStore.list.watch(
    rep,
    () => [],
    (accounts) => accounts.filter((a) => !a.timeDeleted),
  );
  const auth = useAuth2();
  const local = useLocalContext();
  const users = UserStore.list.watch(rep, () => []);
  const r = createSubscription(async (tx) => {
    const stages = await ActiveStages()(tx);
    const apps = await AppStore.all(tx);
    const cols = splitCols(
      pipe(
        apps,
        filter((app) => stages.find((s) => s.appID === app.id) !== undefined),
        sortBy(
          (app) => (app.name === local().app ? 0 : 1),
          [
            (app) =>
              pipe(
                stages,
                filter((s) => s.appID === app.id),
                sortBy((s) => s.timeUpdated),
              ).at(-1)?.timeUpdated || "",
            "desc",
          ],
          (app) => app.name,
        ),
      ),
    );
    const ambiguous = new Set(pipe(
      stages,
      groupBy(
        (s) => `${apps.find((a) => a.id === s.appID)?.name}/${s.name}`,
      ),
      entries,
      filter(([, stages]) => stages.length > 1),
      flatMap(([_, stages]) => stages),
      map((s) => s.id),
    ));

    return {
      apps,
      cols,
      stages,
      ambiguous,
    };
  });
  const nav = useNavigate();
  const selfEmail = createMemo(() => auth.current.email);

  const showApps = createMemo(() => {
    return (query.accounts || null)?.split(",") ?? [];
  });
  const sortedUsers = createMemo(() =>
    sortUsers(
      users().filter((u) => !u.timeDeleted),
      selfEmail(),
    ),
  );
  const usersCapped = createMemo(() =>
    sortedUsers().length > OVERFLOW_USERS_COUNT
      ? sortedUsers().slice(0, OVERFLOW_USERS_DISPLAY)
      : sortedUsers(),
  );

  createEffect(() => {
    if (accounts.ready && !accounts().length && !query.force)
      nav("account", {
        replace: true,
      });
  });

  function expandApp(id: string) {
    setQuery({
      accounts: (showApps().includes(id)
        ? showApps()
        : showApps().concat(id)
      ).join(","),
    });
  }

  function contractApp(id: string) {
    setQuery({
      accounts: showApps()
        .filter((account) => account !== id)
        .join(","),
    });
  }

  function AppCard(props: { app: App.Info }) {
    const children = createMemo(() => {
      return sortBy(
        r.value!.stages.filter((stage) => stage.appID === props.app.id),
        (c) =>
          props.app.name === local().app && c.name === local().stage ? 0 : 1,
        (c) => (c.unsupported ? 1 : 0),
        [(c) => c.timeUpdated, "desc"],
      );
    });
    const repo = createSubscription(RepoFromApp(props.app.id));
    const childrenCapped = createMemo(() =>
      children().length > OVERFLOW_APPS_COUNT
        ? children().slice(0, OVERFLOW_APPS_DISPLAY)
        : children(),
    );
    const showOverflow = createMemo(() => {
      return showApps().includes(props.app.id);
    });
    const lastestRun = createSubscription(async (tx) => {
      const runs = await RunStore.all(tx);
      const run = runs
        .filter((run) => run.appID === props.app.id)
        .sort(
          (a, b) =>
            DateTime.fromISO(b.time.created).toMillis() -
            DateTime.fromISO(a.time.created).toMillis(),
        )[0];
      if (!run) return;
      return run;
    });
    return (
      <Card>
        <CardHeader>
          <BlockLink href={props.app.name}></BlockLink>
          <CardTitle href={props.app.name}>
            <CardTitleIcon>
              <IconApp width="20" height="20" />
            </CardTitleIcon>
            <CardTitleText>{props.app.name}</CardTitleText>
          </CardTitle>
          <Show when={repo.value}>
            <CardTitleRightCol>
              <Switch>
                <Match when={lastestRun.value?.status === "error"}>
                  <CardTitleStatusLink
                    href={`${props.app.name}/autodeploy/${lastestRun.value?.id}`}
                  >
                    <StatusIcon status="error" />
                  </CardTitleStatusLink>
                </Match>
                <Match when={lastestRun.value?.status === "updating"}>
                  <CardTitleStatusLink
                    href={`${props.app.name}/autodeploy/${lastestRun.value?.id}`}
                  >
                    <StatusIcon status="updating" />
                  </CardTitleStatusLink>
                </Match>
              </Switch>
              <RepoLink
                target="_blank"
                rel="noreferrer noopener"
                href={githubRepo(repo.value!.org.login, repo.value!.repo.name)}
              >
                <RepoLinkIcon>
                  <IconGitHub width="14" height="14" />
                </RepoLinkIcon>
                <RepoLinkCopy>{repo.value!.repo.name}</RepoLinkCopy>
              </RepoLink>
            </CardTitleRightCol>
          </Show>
        </CardHeader>
        <div>
          <For each={showOverflow() ? children() : childrenCapped()}>
            {(stage) => (
              <StageCard ambiguous={r.value!.ambiguous.has(stage.id)} stage={stage} />
            )}
          </For>
          <Show when={children().length === 0}>
            <CardStatus>
              <CardStatusIcon status="info">
                <IconExclamationTriangle />
              </CardStatusIcon>
              <Text size="sm" color="dimmed">
                No stages found
              </Text>
            </CardStatus>
          </Show>
          <Show when={children().length > OVERFLOW_APPS_COUNT}>
            <CardOverflowRow>
              <TextButton
                onClick={() => {
                  showOverflow()
                    ? contractApp(props.app.id)
                    : expandApp(props.app.id);
                }}
              >
                <Show when={showOverflow()} fallback="Show all stages">
                  Hide
                </Show>
              </TextButton>
            </CardOverflowRow>
          </Show>
        </div>
      </Card>
    );
  }

  return (
    <Suspense>
      <Header />
      <Switch>
        <Match when={accounts.ready && accounts()?.length === 0}>
          <Fullscreen>
            <Syncing>
              <Stack space="3.5">
                <Text center size="xl" color="secondary">
                  Waiting to connect to your AWS account&hellip;
                </Text>
                <Stack space="2">
                  <Text center size="sm" color="secondary">
                    Double-check that the stack was created in <b>us-east-1</b>.
                  </Text>
                  <Text center size="sm" color="secondary">
                    If not, then remove the stack and{" "}
                    <Link href="account">reconnect it here.</Link>
                  </Text>
                </Stack>
              </Stack>
            </Syncing>
          </Fullscreen>
        </Match>
        <Match when={r.value!}>
          <>
            <Show when={DateTime.now() < DateTime.fromISO("2024-07-31")}>
              <Announcement>
                <AnnouncementTag>New</AnnouncementTag>
                <Text size="sm" on="surface" color="dimmed">
                  {" "}
                  —{" "}
                </Text>
                <Text size="sm" on="surface" color="secondary">
                  Autodeploy your apps with the Console{" "}
                  <a
                    href="https://ion.sst.dev/docs/console/#autodeploy"
                    target="_blank"
                  >
                    Learn more
                    <AnnouncementLinkIcon>
                      <IconChevronRight width="13" height="13" />
                    </AnnouncementLinkIcon>
                  </a>
                </Text>
              </Announcement>
            </Show>
            <Root>
              <Stack space="4">
                <Row space="5" vertical="center" horizontal="between">
                  <PageHeader>
                    <Text size="lg" weight="medium">Overview</Text>
                    <ChevronLink href="settings" size="sm">Manage workspace</ChevronLink>
                  </PageHeader>
                  <Row space="4" vertical="center">
                    <Link href="account">
                      <Button color="secondary">Add AWS Account</Button>
                    </Link>
                    <Link href="user">
                      <Button color="primary">Invite Team</Button>
                    </Link>
                  </Row>
                </Row>
                <Row space="4">
                  <Col>
                    <Show
                      when={r.value!.cols[0].length}
                      fallback={
                        <Card empty>
                          <CardStatus>
                            <CardStatusIcon status="info">
                              <IconArrowPathSpin />
                            </CardStatusIcon>
                            <Text color="dimmed">
                              Searching for apps&hellip;
                            </Text>
                          </CardStatus>
                        </Card>
                      }
                    >
                      <For each={r.value!.cols[0]}>
                        {(app) => <AppCard app={app} />}
                      </For>
                    </Show>
                  </Col>
                  <Col>
                    <Card>
                      <CardHeader>
                        <CardTitleTeam>Team</CardTitleTeam>
                        <CardTitleTeamCount>
                          {sortedUsers().length}
                        </CardTitleTeamCount>
                      </CardHeader>
                      <div>
                        <For each={query.users ? sortedUsers() : usersCapped()}>
                          {(user) => <UserCard id={user.id} />}
                        </For>
                        <Show
                          when={sortedUsers().length > OVERFLOW_USERS_COUNT}
                        >
                          <CardOverflowRow>
                            <TextButton
                              onClick={() =>
                                setQuery({
                                  users: query.users ? undefined : "1",
                                })
                              }
                            >
                              <Show
                                when={query.users}
                                fallback="Show all users"
                              >
                                Hide
                              </Show>
                            </TextButton>
                          </CardOverflowRow>
                        </Show>
                      </div>
                    </Card>
                    <For each={r.value!.cols[1]}>{(app) => <AppCard app={app} />}</For>
                  </Col>
                </Row>
              </Stack>
            </Root>
          </>
        </Match>
      </Switch>
    </Suspense>
  );
}

const StageRoot = styled("div", {
  base: {
    ...utility.row(3),
    height: 52,
    position: "relative",
    alignItems: "center",
    padding: `0 ${theme.space[4]}`,
    justifyContent: "space-between",
    borderTop: `1px solid ${theme.color.divider.base}`,
    selectors: {
      "&:first-child": {
        borderTop: "none",
      },
    },
  },
});

const StageCardLeft = styled("div", {
  base: {
    ...utility.row(3),
    minWidth: 0,
    alignItems: "center",
    justifyContent: "flex-start",
  },
});

const StageLink = styled(Link, {
  base: {
    ...utility.row(2.5),
    zIndex: 2,
    minWidth: 0,
    alignItems: "center",
    color: theme.color.text.primary.base,
  },
  variants: {
    unsupported: {
      true: {
        color: theme.color.text.dimmed.base,
      },
      false: {},
    },
  },
});

const StatusIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    marginInline: 5,
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  variants: {
    status: {
      base: {
        backgroundColor: theme.color.divider.base,
      },
      unsupported: {
        opacity: 0.5,
        backgroundColor: theme.color.divider.base,
      },
      success: {
        backgroundColor: `hsla(${theme.color.base.blue}, 100%)`,
      },
      error: {
        backgroundColor: `hsla(${theme.color.base.red}, 100%)`,
      },
      updating: {
        backgroundColor: `hsla(${theme.color.base.yellow}, 100%)`,
        animation: "glow-pulse-status 1.7s linear infinite alternate",
      },
    },
  },
});

const StageLinkText = styled("span", {
  base: {
    ...utility.text.line,
    minWidth: 0,
    fontSize: theme.font.size.sm,
    lineHeight: "normal",
  },
});

const StageCardLink = styled(Link, {
  base: {
    zIndex: 2,
  },
});

const StageCardRight = styled("div", {
  base: {
    ...utility.row(3),
    alignItems: "center",
    justifyContent: "flex-end",
    flex: "0 0 auto",
  },
});

const StageGitLink = styled("a", {
  base: {
    ...utility.row(1),
    alignItems: "center",
    zIndex: 2,
  },
});

const StageGitIcon = styled("span", {
  base: {
    lineHeight: 0,
    color: theme.color.icon.dimmed,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    width: 14,
    height: 14,
    selectors: {
      [`${StageGitLink}:hover &`]: {
        color: theme.color.text.secondary.base,
      },
    },
  },
});

const StageGitCommit = styled("span", {
  base: {
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
    fontWeight: theme.font.weight.medium,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${StageGitLink}:hover &`]: {
        color: theme.color.link.primary.hover,
      },
    },
  },
});

const StageRegion = styled("span", {
  base: {
    letterSpacing: 0.5,
    minWidth: 110,
    textAlign: "right",
    textTransform: "uppercase",
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

const StageUpdatedTime = styled("span", {
  base: {
    minWidth: 44,
    zIndex: 2,
    textAlign: "right",
    color: theme.color.text.dimmed.base,
    fontSize: theme.font.size.xs,
  },
});

interface StageCardProps {
  stage: Stage.Info;
  ambiguous?: boolean;
}
function StageCard(props: StageCardProps) {
  const app = AppStore.get.watch(useReplicache(), () => [props.stage.appID]);
  const latestUpdate = createSubscription(async (tx) => {
    const updates = await StateUpdateStore.forStage(tx, props.stage.id);
    const latest = updates.sort((a, b) => b.index - a.index)[0];
    return latest;
  });
  const stageUri = () =>
    `${app()?.name}/${props.ambiguous ? props.stage.id : props.stage.name}`;
  const local = useLocalContext();

  function Github() {
    const repoUrl = createSubscription(async (tx) => {
      if (!latestUpdate.value?.runID) return;
      const run = await RunStore.get(
        tx,
        props.stage.id,
        latestUpdate.value.runID,
      );
      if (run.trigger.source !== "github") return;
      const repoUrl = githubRepo(run.trigger.repo.owner, run.trigger.repo.repo);
      return {
        url: githubCommit(repoUrl, run.trigger.commit.id),
        commit: run.trigger.commit.id,
      };
    });
    return (
      <Show when={repoUrl.value}>
        <StageGitLink target="_blank" href={repoUrl.value!.url} rel="noreferrer noopener">
          <StageGitIcon>
            <IconCommit />
          </StageGitIcon>
          <StageGitCommit>{formatCommit(repoUrl.value!.commit)}</StageGitCommit>
        </StageGitLink>
      </Show>
    );
  }

  return (
    <StageRoot>
      <BlockLink href={stageUri()}></BlockLink>
      <StageCardLeft>
        <StageLink
          href={stageUri()}
          unsupported={props.stage.unsupported || false}
        >
          <Switch>
            <Match when={props.stage.unsupported}>
              <StatusIcon status="unsupported" />
            </Match>
            <Match
              when={
                latestUpdate.value?.time.completed &&
                latestUpdate.value?.errors.length === 0
              }
            >
              <StatusIcon status="success" />
            </Match>
            <Match when={latestUpdate.value?.errors.length}>
              <StatusIcon status="error" />
            </Match>
            <Match
              when={latestUpdate.value && !latestUpdate.value.time.completed}
            >
              <StatusIcon status="updating" />
            </Match>
            <Match when={true}>
              <StatusIcon status="base" />
            </Match>
          </Switch>
          <StageLinkText>{props.stage.name}</StageLinkText>
        </StageLink>
        <Switch>
          <Match
            when={
              props.stage.name === local()?.stage &&
              app()?.name === local()?.app
            }
          >
            <Tag level="tip" type="outline">Local</Tag>
          </Match>
          <Match when={latestUpdate.value?.errors.length}>
            <StageCardLink
              href={`${stageUri()}/updates/${latestUpdate.value?.id}`}
            >
              <Tag type="outline" level="danger">Error</Tag>
            </StageCardLink>
          </Match>
          <Match when={props.stage.unsupported}>
            <Tag type="outline">Upgrade</Tag>
          </Match>
        </Switch>
      </StageCardLeft>
      <StageCardRight>
        <Switch>
          <Match when={latestUpdate.value}>
            <Github />
          </Match>
        </Switch>
        <StageRegion>{props.stage.region}</StageRegion>
        <StageUpdatedTime
          title={parseTime(props.stage.timeUpdated).toLocaleString(
            DateTime.DATETIME_FULL,
          )}
        >
          {formatSinceTime(props.stage.timeUpdated, false, true)}
        </StageUpdatedTime>
      </StageCardRight>
    </StageRoot>
  );
}

const UserRoot = styled("div", {
  base: {
    ...utility.row(3),
    height: 52,
    alignItems: "center",
    padding: `0 ${theme.space[2]} 0 ${theme.space[4]}`,
    justifyContent: "space-between",
    borderTop: `1px solid ${theme.color.divider.base}`,
    selectors: {
      "&:first-child": {
        borderTop: "none",
      },
    },
  },
});

type UserCardProps = {
  id: string;
};

function UserCard(props: UserCardProps) {
  const rep = useReplicache();
  const user = UserStore.get.watch(rep, () => [props.id]);
  const auth = useAuth2();

  return (
    <UserRoot>
      <Row space="2" vertical="center">
        <AvatarInitialsIcon
          type="user"
          text={user()?.email || ""}
          style={{ width: "20px", height: "20px" }}
        />
        <Text line size="base" leading="normal">
          {user()?.email}
        </Text>
      </Row>
      <Row flex={false} space="2" vertical="center">
        <Show when={!user()?.timeSeen}>
          <Tag level="tip">Invited</Tag>
        </Show>
        <Show when={auth.current.email !== user()?.email}>
          <Dropdown
            size="sm"
            icon={<IconEllipsisVertical width={18} height={18} />}
          >
            <Dropdown.Item
              onSelect={() => {
                if (
                  !confirm(
                    "Are you sure you want to remove them from the workspace?",
                  )
                )
                  return;

                rep().mutate.user_remove(props.id);
              }}
            >
              Remove from workspace
            </Dropdown.Item>
          </Dropdown>
        </Show>
      </Row>
    </UserRoot>
  );
}
