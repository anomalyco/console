import { useReplicache } from "$/providers/replicache";
import { TextButton } from "$/ui/button";
import { FormField, Input } from "$/ui/form";
import { Stack, Row } from "$/ui/layout";
import { Modal } from "$/ui/modal";
import { theme } from "$/ui/theme";
import { styled } from "@macaron-css/solid";
import { createId } from "@paralleldrive/cuid2";
import { batch, createEffect } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";

function init() {
  const [state, setState] = createStore<{
    show: boolean;
    key: string;
    payload: any;
  }>({
    show: false,
    payload: null,
    key: "",
  });

  const input = () =>
    document.querySelector<HTMLInputElement>(
      "[data-element=save-payload-dialog-name]",
    )!;

  return {
    state,
    control: {
      show(key: string, payload: any) {
        batch(() => {
          setState("show", true);
          setState("key", key);
          setState("payload", payload);
        });
        setTimeout(() => input().focus(), 0);
      },
      hide() {
        setState("show", false);
        // input().value = "";
      },
    },
  };
}

export type DialogPayloadSaveControl = ReturnType<typeof init>["control"];

const Form = styled("form", {
  base: {
    padding: theme.space[5],
    width: theme.modalWidth.sm,
  },
});

export function DialogPayloadSave(props: {
  control: (control: DialogPayloadSaveControl) => void;
}) {
  const { state, control } = init();
  const rep = useReplicache();

  createEffect(() => {
    props.control(control);
  });

  return (
    <Modal onClose={() => control.hide()} show={state.show}>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          rep().mutate.function_payload_save({
            id: createId(),
            payload: structuredClone(unwrap(state.payload)),
            key: state.key,
            name: fd.get("name") as string,
          });
          control.hide();
        }}
      >
        <Stack space="5">
          <Stack space="2">
            <Text size="lg" weight="medium">
              Save event to workspace
            </Text>
          </Stack>
          <FormField
            label="Event name"
            hint="Give the event a short recognizable name."
          >
            <Input
              data-element={"save-payload-dialog-name"}
              name="name"
              minLength={1}
              placeholder="EventA"
            />
          </FormField>
          <Row space="5" vertical="center" horizontal="end">
            <TextButton onClick={() => control.hide()}>Cancel</TextButton>
            <Button color="success">Save Event</Button>
          </Row>
        </Stack>
      </Form>
    </Modal>
  );
}
