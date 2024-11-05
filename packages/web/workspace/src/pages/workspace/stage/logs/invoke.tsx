import { useReplicache } from "$/providers/replicache";
import {
  IconSubRight,
  IconCaretRight,
  IconCaretRightOutline,
} from "$/ui/icons/custom";
import { style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { createStore } from "solid-js/store";
import {
  DialogPayloadSave,
  DialogPayloadSaveControl,
} from "./dialog-payload-save";
import {
  DialogPayloadManage,
  DialogPayloadManageControl,
} from "./dialog-payload-manage";
import { useCommandBar } from "../../command-bar";
import { IconBookmark } from "$/ui/icons";
import { LambdaPayloadStore } from "$/data/lambda-payload";
import { useStageContext } from "../context";
import { Show, createEffect, createMemo } from "solid-js";
import { createScan2 } from "$/data/store";
import { useApi, useWorkspace } from "../../context";
import { bus } from "$/providers/bus";
import { LinkButton, IconButton } from "$/ui/button";
import { Row } from "$/ui/layout";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";

const InvokeRoot = styled("div", {
  base: {
    ...utility.row(0),
    justifyContent: "space-between",
    paddingLeft: theme.space[3],
    alignItems: "center",
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    ":last-child": {
      borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
    },
    ":focus-within": {},
  },
  variants: {
    expand: {
      true: {
        ...utility.stack(0),
        //backgroundColor: theme.color.input.background,
        height: "auto",
        alignItems: "stretch",
        padding: 0,
        paddingBottom: theme.space[3],
        resize: "vertical",
        overflow: "auto",
        minHeight: 170,
      },
      false: {
        cursor: "text",
      },
    },
  },
});

const InvokeControls = styled("div", {
  base: {
    ...utility.row(0),
    height: 51,
    justifyContent: "space-between",
    padding: `0 ${theme.space[3]} 0 ${theme.space[4]}`,
    selectors: {
      [`${InvokeRoot.selector({ expand: true })} &`]: {
        height: "auto",
        flex: "0 0 auto",
        padding: `${theme.space[3]} ${theme.space[3]} 0 ${theme.space[4]}`,
      },
    },
  },
});

const InvokeControlsLeft = styled("div", {
  base: {
    ...utility.row(3),
    alignItems: "center",
    display: "none",
    selectors: {
      [`${InvokeRoot.selector({ expand: true })} &`]: {
        display: "flex",
      },
    },
  },
});

const InvokeControlsCancel = styled(LinkButton, {
  base: {
    display: "none",
    selectors: {
      [`${InvokeRoot.selector({ expand: true })} &`]: {
        display: "initial",
      },
    },
  },
});

const InvokeControlsButton = style({
  display: "none",
  selectors: {
    [`${InvokeRoot.selector({ expand: true })} &`]: {
      display: "initial",
    },
  },
});

const InvokeControlsLinkButton = style({
  display: "initial",
  selectors: {
    [`${InvokeRoot.selector({ expand: true })} &`]: {
      display: "none",
    },
  },
});

const InvokePayloadLabel = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    left: theme.space[3],
    selectors: {
      [`${InvokeRoot.selector({ expand: true })} &`]: {
        display: "none",
      },
    },
  },
});

const InvokePayloadLabelIcon = styled("div", {
  base: {
    width: 20,
    height: 20,
    color: theme.color.icon.dimmed,
  },
});

const InvokeTextArea = styled("textarea", {
  base: {
    display: "none",
    flex: "1 1 auto",
    padding: theme.space[4],
    border: "none",
    resize: "none",
    height: "100%",
    lineHeight: theme.font.lineHeight,
    appearance: "none",
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    background: "transparent",
    selectors: {
      [`${InvokeRoot.selector({ expand: true })} &`]: {
        display: "block",
      },
    },
  },
});

export interface InvokeControl {
  savePayload(payload: string): void;
}

interface Props {
  control: (control: InvokeControl) => void;
  onExpand: () => void;
  onInvoke: (payload: any) => Promise<void>;
  arn: string;
}

export function Invoke(props: Props) {
  const bar = useCommandBar();
  let invokeTextArea!: HTMLTextAreaElement;
  let saveControl!: DialogPayloadSaveControl;
  let manageControl!: DialogPayloadManageControl;
  const api = useApi();
  const rep = useReplicache();
  const stage = useStageContext();
  const key = createMemo(() => [stage.app.name, props.arn].join("-"));
  const lambdaPayloads = LambdaPayloadStore.list.watch(
    rep,
    () => [],
    (items) => items.filter((payload) => payload.key === key()),
  );

  const test = createScan2(() => "/lambdaPayload", rep);

  createEffect(() => {
    console.log([...test()]);
  });

  createEffect(() => {
    props.control({
      savePayload(payload) {
        saveControl.show(key(), payload);
      },
    });
  });

  function setPayload(value: any) {
    invokeTextArea.value = JSON.stringify(value, null, 2).trim();
    setInvoke("expand", true);
    invokeTextArea.focus();
    invokeTextArea.selectionStart = 0;
    invokeTextArea.selectionEnd = 0;
    invokeTextArea.scrollTop = 0;
  }

  async function handleInvoke() {
    try {
      const payload = JSON.parse(invokeTextArea.value || "{}");
      setInvoke("error", false);
      setInvoke("invoking", true);
      await props.onInvoke(payload);
      setInvoke("invoking", false);
    } catch (ex) {
      console.error(ex);
      setInvoke("error", true);
    }
  }
  const [invoke, setInvoke] = createStore<{
    invoking: boolean;
    expand: boolean;
    error: boolean;
    empty: boolean;
  }>({
    expand: false,
    error: false,
    invoking: false,
    empty: true,
  });

  bar.register("lambda-payloads", async (filter, global) => {
    if (global && !filter) return [];
    return lambdaPayloads().map((x) => ({
      icon: IconCaretRight,
      category: "Event Payloads",
      title: x.name,
      async run(control) {
        setPayload(x.payload);
        control.hide();
      },
    }));
  });

  bar.register("invoke", async (filter, global) => {
    if (!invoke.expand) return [];
    return [
      {
        icon: IconSubRight,
        category: "Invoke",
        title: "Load saved payloads...",
        async run(control) {
          control.show("lambda-payloads");
        },
      },
      {
        icon: IconBookmark,
        category: "Invoke",
        title: "Manage saved payloads",
        async run(control) {
          control.hide();
          manageControl.show();
        },
      },
    ];
  });

  return (
    <>
      <InvokeRoot
        expand={invoke.expand}
        style={{
          /** Overrides height set by Chrome after resizing **/
          height: "auto",
        }}
        onClick={(e) => {
          props.onExpand();
          setInvoke("expand", true);
          invokeTextArea.focus();
        }}
      >
        <InvokePayloadLabel>
          <InvokePayloadLabelIcon>
            <IconCaretRightOutline />
          </InvokePayloadLabelIcon>
          <Text leading="normal" size="sm" color="dimmed">
            Enter event payload to invoke
          </Text>
        </InvokePayloadLabel>
        <InvokeTextArea
          rows={7}
          spellcheck={false}
          ref={invokeTextArea}
          onInput={(e) => {
            setInvoke("empty", !Boolean(e.currentTarget.value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.stopPropagation();
              handleInvoke();
            }
          }}
        />
        <InvokeControls>
          <InvokeControlsLeft>
            <IconButton
              title="Load saved payloads"
              onClick={() => manageControl.show()}
            >
              <IconBookmark display="block" width={24} height={24} />
            </IconButton>
            <LinkButton
              style={{ display: invoke.empty ? "none" : "inline" }}
              onClick={() => {
                try {
                  const parsed = JSON.parse(invokeTextArea.value);
                  saveControl.show(key(), parsed);
                } catch (ex) {
                  console.error(ex);
                  setInvoke("error", true);
                }
              }}
            >
              Save
            </LinkButton>
          </InvokeControlsLeft>
          <Row vertical="center" space="6">
            <Show when={invoke.error}>
              <Text color="danger" size="sm" leading="normal">
                Payload needs to be valid JSON.
              </Text>
            </Show>
            <Row vertical="center" space="4">
              <InvokeControlsCancel
                onClick={(e) => {
                  e.stopPropagation();
                  setInvoke("expand", false);
                  setInvoke("error", false);
                }}
              >
                Cancel
              </InvokeControlsCancel>
              <Button
                color="secondary"
                onClick={handleInvoke}
                disabled={invoke.invoking}
                class={InvokeControlsButton}
              >
                {invoke.invoking ? "Invoking" : "Invoke"}
              </Button>
            </Row>
          </Row>
        </InvokeControls>
      </InvokeRoot>
      <DialogPayloadSave control={(control) => (saveControl = control)} />
      <DialogPayloadManage
        lambdaPayloads={lambdaPayloads()}
        onSelect={(item) => setPayload(item.payload)}
        control={(control) => (manageControl = control)}
      />
    </>
  );
}
