import { createEffect } from "solid-js";
import { createId } from "@paralleldrive/cuid2";
import { useReplicache } from "@console/web/providers/replicache";
import { useNavigate } from "@solidjs/router";
import { Modal } from "@console/web/ui/modal";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { styled } from "@macaron-css/solid";
import { Button, TextButton } from "@console/web/ui/button";
import { createStore } from "solid-js/store";

const Root = styled("div", {
  base: {
    width: theme.modalWidth.sm,
  },
});

const Form = styled("div", {
  base: {
    ...utility.stack(9),
    padding: `${theme.space[7]} ${theme.space[5]} ${theme.space[4]}`,
  },
});

const CopyRow = styled("div", {
  base: {
    ...utility.stack(1),
  },
});

const Copy = styled("p", {
  base: {
    textAlign: "center",
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.primary.base,
  },
});

const Desc = styled("p", {
  base: {
    paddingInline: theme.space[6],
    textAlign: "center",
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.secondary.base,
  },
});

const Controls = styled("div", {
  base: {
    ...utility.row(0),
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const ControlsRight = styled("div", {
  base: {
    ...utility.row(5),
    alignItems: "center",
    justifyContent: "flex-end",
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

export type DialogRedeployControl = ReturnType<typeof init>["control"];

export function DialogRedeploy(props: {
  runID: string;
  control: (control: DialogRedeployControl) => void;
}) {
  const { state, control } = init();
  const rep = useReplicache();

  const nav = useNavigate();

  createEffect(() => {
    props.control(control);
  });

  async function onDeploy(force: boolean) {
    const id = createId();
    await rep().mutate.run_redeploy({
      id,
      force,
      runID: props.runID,
    });
    control.hide();
    nav(`../${id}`);
  }

  return (
    <Modal onClose={() => control.hide()} show={state.show}>
      <Root>
        <Form>
          <CopyRow>
            <Copy>Redeploy this commit</Copy>
            <Desc>You can also clear the cache and unlock the stage by forcing the deploy.</Desc>
          </CopyRow>
          <Controls>
            <Button color="secondary" onClick={async () => await onDeploy(true)}>
              Force Redeploy
            </Button>
            <ControlsRight>
              <TextButton onClick={() => control.hide()}>Cancel</TextButton>
              <Button color="success" onClick={async () => await onDeploy(false)}>
                Redeploy
              </Button>
            </ControlsRight>
          </Controls>
        </Form>
      </Root>
    </Modal>
  );
}
