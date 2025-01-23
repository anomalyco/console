import { UserStore } from "@console/web/data/user";
import { useReplicache } from "@console/web/providers/replicache";
import { IconBookmark, IconTrash, IconXMark } from "@console/web/ui/icons";
import { Stack, Row } from "@console/web/ui/layout";
import { Modal } from "@console/web/ui/modal";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { Actor, UserActor } from "@console/core/actor";
import type { LambdaPayload } from "@console/core/lambda/index";
import { styled } from "@macaron-css/solid";
import { For, Show, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { Text } from "@console/web/ui/text";

const Header = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${theme.space[5]} ${theme.space[5]} calc(${theme.space[5]} - 2px)`,
  },
});

const Title = styled("p", {
  base: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
    lineHeight: "normal",
  },
});

const IconClose = styled("button", {
  base: {
    width: 24,
    height: 24,
    color: theme.color.icon.dimmed,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    ":hover": {
      color: theme.color.icon.secondary,
    },
  },
});

const Empty = styled("div", {
  base: {
    ...utility.stack(4),
    height: 320,
    alignItems: "center",
    justifyContent: "center",
    borderTop: `1px solid ${theme.color.divider.base}`,
  },
});

const List = styled("div", {
  base: {
    borderTop: `1px solid ${theme.color.divider.base}`,
    maxHeight: 320,
    overflowY: "auto",
  },
});

const ListItem = styled("div", {
  base: {
    ...utility.row(5),
    padding: `${theme.space[4]} ${theme.space[5]}`,
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: `1px solid ${theme.color.divider.base}`,
    ":hover": {
      background: theme.color.background.hover,
    },
    selectors: {
      "&:first-child": {
        borderTop: "none",
      },
    },
  },
});

const ListItemCol = styled("div", {
  base: {
    ...utility.stack(2),
    minWidth: 0,
  },
  variants: {
    side: {
      left: {
        flex: 2,
      },
      right: {
        flex: 1,
        textAlign: "right",
      },
    },
  },
});
const RemoveIcon = styled("div", {
  base: {
    width: 18,
    height: 18,
    flex: "0 0 auto",
    color: theme.color.icon.secondary,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    ":hover": {
      color: theme.color.icon.primary,
    },
  },
});

const Root = styled("div", {
  base: {
    width: theme.modalWidth.md,
  },
});

function init() {
  const [state, setState] = createStore<{
    show: boolean;
  }>({
    show: false,
  });

  return {
    state,
    control: {
      show() {
        setState("show", true);
      },
      hide() {
        setState("show", false);
      },
    },
  };
}

export type DialogPayloadManageControl = ReturnType<typeof init>["control"];

export function DialogPayloadManage(props: {
  lambdaPayloads: LambdaPayload[];
  onSelect: (payload: LambdaPayload) => void;
  control: (control: DialogPayloadManageControl) => void;
}) {
  const { state, control } = init();
  const rep = useReplicache();

  createEffect(() => {
    props.control(control);
  });

  return (
    <Modal onClose={() => control.hide()} show={state.show}>
      <Root>
        <Stack>
          <Header>
            <Title>Saved event payloads</Title>
            <IconClose onClick={() => control.hide()}>
              <IconXMark />
            </IconClose>
          </Header>
          <Show when={!props.lambdaPayloads.length}>
            <Empty>
              <IconBookmark
                width={28}
                height={28}
                color={theme.color.icon.dimmed}
              />
              <Text center color="dimmed">
                You have no saved payloads for this function
              </Text>
            </Empty>
          </Show>
          <Show when={props.lambdaPayloads.length}>
            <List>
              <For each={props.lambdaPayloads}>
                {(item) => (
                  <ListItem
                    onClick={() => {
                      props.onSelect(item);
                      control.hide();
                    }}
                  >
                    <Row
                      space="5"
                      horizontal="between"
                      style={{ "flex-grow": 1 }}
                    >
                      <ListItemCol side="left">
                        <Text line leading="normal" weight="medium">
                          {item.name}
                        </Text>
                        <Text
                          line
                          code
                          leading="normal"
                          color="dimmed"
                          size="mono_sm"
                        >
                          {JSON.stringify(item.payload)}
                        </Text>
                      </ListItemCol>
                      <ListItemCol side="right">
                        <Text line leading="normal" color="secondary" size="sm">
                          <Show
                            when={
                              (item.creator as Actor)?.type === "user" &&
                              (item.creator as UserActor)
                            }
                          >
                            {(creator) => {
                              const user = UserStore.get.watch(rep, () => [
                                creator().properties.userID,
                              ]);
                              return <span>{user()?.email || ""}</span>;
                            }}
                          </Show>
                        </Text>
                        <Text line leading="normal" color="dimmed" size="xs">
                          {new Date(item.timeCreated).toLocaleDateString()}
                        </Text>
                      </ListItemCol>
                    </Row>
                    <RemoveIcon
                      title="Remove saved payload"
                      onClick={(e) => {
                        e.stopPropagation();
                        rep().mutate.function_payload_remove(item.id);
                      }}
                    >
                      <IconTrash />
                    </RemoveIcon>
                  </ListItem>
                )}
              </For>
            </List>
          </Show>
        </Stack>
      </Root>
    </Modal>
  );
}
