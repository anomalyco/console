import { AccountStore } from "$/data/aws";
import { createSubscription, useReplicache } from "$/providers/replicache";
import { Dropdown } from "$/ui/dropdown";
import { IconEllipsisVertical, IconExclamationTriangle } from "$/ui/icons";
import { IconAws, IconAdd, IconArrowPathSpin } from "$/ui/icons/custom";
import { Stack } from "$/ui/layout";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { styled } from "@macaron-css/solid";
import { Link } from "@solidjs/router";
import { For, Show, Switch, Match } from "solid-js";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";
import { DateTime } from "luxon";

const Root = styled("div", {
  base: {},
});

const Card = styled("div", {
  base: {
    ...utility.row(3.5),
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const CardLeft = styled("div", {
  base: {
    ...utility.row(3),
    alignItems: "center",
  },
});

const CardTitle = styled("p", {
  base: {
    fontWeight: theme.font.weight.medium,
  },
});

const CardDesc = styled("p", {
  base: {
    color: theme.color.text.dimmed.base,
    fontSize: theme.font.size.sm,
  },
});

const CardError = styled(Link, {
  base: {
    textUnderlineOffset: 3,
    textDecoration: "underline",
    fontSize: theme.font.size.sm,
    color: `hsla(${theme.color.base.red}, 100%)`,
    ":hover": {
      color: `hsla(${theme.color.base.red}, 100%)`,
    },
  },
});

const CardRight = styled("div", {
  base: {
    ...utility.row(5),
    alignItems: "center",
  },
});

const CardActions = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
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
    ...utility.row(1.5),
    alignItems: "center",
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

const CardStatusCopy = styled("span", {
  base: {
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
  },
});

const AddAccountLink = styled(Link, {
  base: {
    fontSize: theme.font.size.sm,
  },
});

const AddIcon = styled("span", {
  base: {
    paddingRight: 6,
  },
});

export function AWS() {
  const accounts = createSubscription(AccountStore.list, []);
  const rep = useReplicache();

  return (
    <Stack space="10" id="accounts">
      <Stack space="3">
        <Text size="lg" weight="medium">
          Accounts
        </Text>
        <Text size="sm" color="dimmed">
          Connect and manage your AWS accounts
        </Text>
      </Stack>
      <Root>
        <Show
          when={accounts.value.length}
          fallback={
            <Link href="../account">
              <Button>Connect an AWS Account</Button>
            </Link>
          }
        >
          <Stack space="7">
            <For each={accounts.value}>
              {(account) => (
                <Card>
                  <CardLeft>
                    <IconAws width="32" height="32" />
                    <Stack space="1.5">
                      <CardTitle>{account.accountID}</CardTitle>
                      <Show
                        when={account.timeFailed}
                        fallback={<CardDesc>Connected</CardDesc>}
                      >
                        <CardDesc>Disconnected</CardDesc>
                      </Show>
                    </Stack>
                  </CardLeft>
                  <CardRight>
                    <Switch>
                      <Match when={account.timeFailed}>
                        <CardStatus>
                          <CardStatusIcon status="error">
                            <IconExclamationTriangle />
                          </CardStatusIcon>
                          <CardError href="../account">
                            Reconnect account
                          </CardError>
                        </CardStatus>
                      </Match>
                      <Match
                        when={!account.timeDiscovered && !account.timeFailed}
                      >
                        <CardStatus>
                          <CardStatusIcon status="info">
                            <IconArrowPathSpin />
                          </CardStatusIcon>
                          <CardStatusCopy>
                            Searching for SST apps&hellip;
                          </CardStatusCopy>
                        </CardStatus>
                      </Match>
                    </Switch>
                    <CardActions>
                      <Button
                        color="secondary"
                        disabled={
                          (account.timeDiscovered === null ||
                            account.timeFailed !== null) &&
                          account.timeUpdated >
                            DateTime.now().toUTC().minus({ minute: 1 }).toSQL()
                        }
                        onClick={() => {
                          rep().mutate.aws_account_scan(account.id);
                        }}
                      >
                        Rescan
                      </Button>
                      <Dropdown
                        icon={<IconEllipsisVertical width={18} height={18} />}
                      >
                        <Dropdown.Item
                          onSelect={() => {
                            if (
                              !confirm(
                                "Are you sure you want to remove this account?",
                              )
                            )
                              return;
                            rep().mutate.aws_account_remove(account.id);
                          }}
                        >
                          Remove account
                        </Dropdown.Item>
                      </Dropdown>
                    </CardActions>
                  </CardRight>
                </Card>
              )}
            </For>
            <AddAccountLink href="../account">
              <AddIcon>
                <IconAdd width="10" height="10" />
              </AddIcon>
              Connect another account
            </AddAccountLink>
          </Stack>
        </Show>
      </Root>
    </Stack>
  );
}
