import { DateTime } from "luxon";
import { AppStore } from "@console/web/data/app";
import { UserStore } from "@console/web/data/user";
import { AccountStore } from "@console/web/data/aws";
import { StageStore } from "@console/web/data/stage";
import { useReplicache } from "@console/web/providers/replicache";
import { Fullscreen, Row, Stack } from "@console/web/ui/layout";
import { Dropdown } from "@console/web/ui/dropdown";
import {
  IconChevronRight,
  IconEllipsisVertical,
  IconExclamationTriangle,
} from "@console/web/ui/icons";
import { AvatarInitialsIcon } from "@console/web/ui/avatar-icon";
import { Syncing } from "@console/web/ui/loader";
import { IconApp, IconArrowPathSpin } from "@console/web/ui/icons/custom";
import type { Stage } from "@console/core/app/index";
import type { Account } from "@console/core/aws/account";
import { styled } from "@macaron-css/solid";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { For, Match, Show, Switch, createEffect, createMemo } from "solid-js";
import { Header } from "./header";
import { useLocalContext } from "@console/web/providers/local";
import { filter, flatMap, groupBy, map, pipe, sortBy, entries } from "remeda";
import { User } from "@console/core/user/index";
import { TextButton } from "@console/web/ui/button";
import { Tag } from "@console/web/ui/tag";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { Text } from "@console/web/ui/text";
import { Button } from "@console/web/ui/button";
import { useAccount } from "@console/web/providers/account";

const OVERFLOW_APPS_COUNT = 9;
const OVERFLOW_APPS_DISPLAY = 6;
const OVERFLOW_USERS_COUNT = 7;
const OVERFLOW_USERS_DISPLAY = 5;

const Root = styled("div", {
  base: {
    padding: theme.space[4],
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
    height: 40,
    justifyContent: "space-between",
  },
});

const ManageIcon = styled("div", {
  base: {
    top: 2,
    position: "relative",
    opacity: theme.iconOpacity,
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
});

const CardHeader = styled("div", {
  base: {
    ...utility.row(0.5),
    height: 46,
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${theme.space[2]} 0 ${theme.space[4]}`,
    borderBottom: `1px solid ${theme.color.divider.base}`,
  },
});

const CardErrorCopy = styled(Text, {
  base: {
    fontSize: theme.font.size.sm,
    color: `hsla(${theme.color.base.red}, 100%)`,
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

function splitCols(array: Account.Info[]) {
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

export function Overview() {
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
  const account = useAccount()
  const users = UserStore.list.watch(rep, () => []);
  const cols = createMemo(() => splitCols(accounts() || []));
  const stages = StageStore.list.watch(rep, () => []);
  const apps = AppStore.all.watch(rep, () => []);
  const nav = useNavigate();
  const selfEmail = createMemo(() => account.current.email);
  const ambiguous = createMemo(() => {
    const result = pipe(
      stages(),
      groupBy((s) => `${apps().find((a) => a.id === s.appID)?.name}/${s.name}`),
      entries,
      filter(([, stages]) => stages.length > 1),
      flatMap(([_, stages]) => stages),
      map((s) => s.id),
    );
    console.log({ ambiguous: result });
    return new Set(result);
  });

  const showAccounts = createMemo(() => {
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

  function setShowAccounts(id: string) {
    setQuery({
      accounts: (showAccounts().includes(id)
        ? showAccounts()
        : showAccounts().concat(id)
      ).join(","),
    });
  }

  function unsetShowAccounts(id: string) {
    setQuery({
      accounts: showAccounts()
        .filter((account) => account !== id)
        .join(","),
    });
  }

  function renderAccount(account: Account.Info) {
    const local = useLocalContext();
    const children = createMemo(() => {
      return sortBy(
        stages().filter((stage) => stage.awsAccountID === account.id),
        (c) =>
          apps().find((app) => app.id === c.appID)?.name === local.app &&
            c.name === local.stage
            ? 0
            : 1,
        (c) => (c.unsupported ? 1 : 0),
        (c) => apps().find((app) => app.id === c.appID)?.name || "",
        (c) => c.name,
      );
    });
    const childrenCapped = createMemo(() =>
      children().length > OVERFLOW_APPS_COUNT
        ? children().slice(0, OVERFLOW_APPS_DISPLAY)
        : children(),
    );
    const showOverflow = createMemo(() => {
      return showAccounts().includes(account.accountID);
    });
    return (
      <Card>
        <CardHeader>
          <Row space="0.5">
            <Text code size="mono_sm" color="dimmed">
              ID:
            </Text>
            <Text code size="mono_sm" color="dimmed">
              {account.accountID}
            </Text>
          </Row>
          <Dropdown
            size="sm"
            icon={<IconEllipsisVertical width={18} height={18} />}
          >
            <Dropdown.Item
              disabled={account.timeDiscovered === null}
              onSelect={() => {
                rep().mutate.aws_account_scan(account.id);
              }}
            >
              <Show
                when={account.timeDiscovered}
                fallback="Rescanning account…"
              >
                Rescan account
              </Show>
            </Dropdown.Item>
            <Dropdown.Seperator />
            <Dropdown.Item
              onSelect={() => {
                if (!confirm("Are you sure you want to remove this account?"))
                  return;
                rep().mutate.aws_account_remove(account.id);
              }}
            >
              Remove account
            </Dropdown.Item>
          </Dropdown>
        </CardHeader>
        <div>
          <Show when={account.timeFailed}>
            <CardStatus>
              <CardStatusIcon status="error">
                <IconExclamationTriangle />
              </CardStatusIcon>
              <A href="account">
                <CardErrorCopy>Reconnect account</CardErrorCopy>
              </A>
            </CardStatus>
          </Show>
          <Show when={!account.timeDiscovered && !account.timeFailed}>
            <CardStatus>
              <CardStatusIcon status="info">
                <IconArrowPathSpin />
              </CardStatusIcon>
              <Text size="sm" color="dimmed">
                Searching for SST apps&hellip;
              </Text>
            </CardStatus>
          </Show>
          <For each={showOverflow() ? children() : childrenCapped()}>
            {(stage) => (
              <StageCard ambiguous={ambiguous().has(stage.id)} stage={stage} />
            )}
          </For>
          <Show
            when={
              children().length === 0 &&
              !account.timeFailed &&
              account.timeDiscovered
            }
          >
            <CardStatus>
              <CardStatusIcon status="info">
                <IconExclamationTriangle />
              </CardStatusIcon>
              <Text size="sm" color="dimmed">
                No SST v2 apps found
              </Text>
            </CardStatus>
          </Show>
          <Show when={children().length > OVERFLOW_APPS_COUNT}>
            <CardOverflowRow>
              <TextButton
                onClick={() => {
                  showOverflow()
                    ? unsetShowAccounts(account.accountID)
                    : setShowAccounts(account.accountID);
                }}
              >
                <Show when={showOverflow()} fallback="Show all apps">
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
    <>
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
                    <A href="account">reconnect it here.</A>
                  </Text>
                </Stack>
              </Stack>
            </Syncing>
          </Fullscreen>
        </Match>
        <Match when={true}>
          <>
            <Show when={DateTime.now() < DateTime.fromISO("2025-02-07")}>
              <Announcement>
                <AnnouncementTag>New</AnnouncementTag>
                <Text size="sm" on="surface" color="dimmed">
                  {" "}
                  —{" "}
                </Text>
                <Text size="sm" on="surface" color="secondary">
                  Want to host the Console in your AWS account?{" "}
                  <a href="https://forms.gle/iBVtq6zi6biAbZKy7" target="_blank">
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
                    <Text size="lg" weight="medium">
                      Overview
                    </Text>
                    <A href="settings">
                      <TextButton>
                        <Row space="0.5" horizontal="center">
                          Manage workspace
                          <ManageIcon>
                            <IconChevronRight width="13" height="13" />
                          </ManageIcon>
                        </Row>
                      </TextButton>
                    </A>
                  </PageHeader>
                  <Row space="4" vertical="center">
                    <A href="account">
                      <Button color="secondary">Add AWS Account</Button>
                    </A>
                    <A href="user">
                      <Button color="primary">Invite Team</Button>
                    </A>
                  </Row>
                </Row>
                <Row space="4">
                  <Col>
                    <For each={cols()[0]}>{renderAccount}</For>
                  </Col>
                  <Col>
                    <Card>
                      <CardHeader>
                        <Row space="0.5">
                          <Text code size="mono_sm" color="dimmed">
                            Team:
                          </Text>
                          <Text code size="mono_sm" color="dimmed">
                            {sortedUsers().length}
                          </Text>
                        </Row>
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
                    <For each={cols()[1]}>{renderAccount}</For>
                  </Col>
                </Row>
              </Stack>
            </Root>
          </>
        </Match>
      </Switch>
    </>
  );
}

const StageRoot = styled(A, {
  base: {
    ...utility.row(3),
    height: 58,
    alignItems: "center",
    padding: `0 ${theme.space[4]}`,
    justifyContent: "space-between",
    borderTop: `1px solid ${theme.color.divider.base}`,
    ":hover": {
      backgroundColor: theme.color.background.hover,
    },
    selectors: {
      "&:first-child": {
        borderTop: "none",
      },
    },
  },
});

const StageIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 16,
    height: 16,
    color: theme.color.icon.secondary,
  },
  variants: {
    dimmed: {
      true: {
        color: theme.color.icon.dimmed,
      },
      false: {},
    },
  },
});

const StageCardTags = styled("div", {
  base: {
    ...utility.row(3),
    alignItems: "center",
    flex: "0 0 auto",
  },
});

interface StageCardProps {
  stage: Stage.Info;
  ambiguous?: boolean;
}
function StageCard(props: StageCardProps) {
  const app = AppStore.get.watch(useReplicache(), () => [props.stage.appID]);
  const local = useLocalContext();
  return (
    <StageRoot
      href={`${app()?.name}/${props.ambiguous ? props.stage.id : props.stage.name
        }`}
    >
      <Row space="2" vertical="center">
        <StageIcon dimmed={props.stage.unsupported || false}>
          <IconApp />
        </StageIcon>
        <Row space="1" vertical="center">
          <Text
            line
            size="base"
            weight="medium"
            leading="normal"
            color={props.stage.unsupported ? "dimmed" : "primary"}
          >
            {app()?.name}
          </Text>
          <Text size="base" color="dimmed">
            /
          </Text>
          <Text
            line
            size="base"
            weight="medium"
            leading="normal"
            color={props.stage.unsupported ? "dimmed" : "primary"}
          >
            {props.stage.name}
          </Text>
        </Row>
      </Row>
      <StageCardTags>
        <Show when={props.stage.name === local.stage && app.name === local.app}>
          <Tag level="tip" type="outline">
            Local
          </Tag>
        </Show>
        <Show when={props.stage.unsupported}>
          <Tag type="outline">Upgrade</Tag>
        </Show>
        <Tag type="outline">{props.stage.region}</Tag>
      </StageCardTags>
    </StageRoot>
  );
}

const UserRoot = styled("div", {
  base: {
    ...utility.row(3),
    height: 58,
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

type UserCardProps = {
  id: string;
};

function UserCard(props: UserCardProps) {
  const rep = useReplicache();
  const user = UserStore.get.watch(rep, () => [props.id]);
  const account = useAccount()

  return (
    <UserRoot>
      <Row space="2" vertical="center">
        <AvatarInitialsIcon
          type="user"
          text={user()?.email || ""}
          style={{ width: "24px", height: "24px" }}
        />
        <Text line size="base" leading="normal">
          {user()?.email}
        </Text>
      </Row>
      <Row flex={false} space="2" vertical="center">
        <Show when={!user()?.timeSeen}>
          <Tag level="tip">Invited</Tag>
        </Show>
        <Show when={account.current.email !== user()?.email}>
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
