import { createId } from "@paralleldrive/cuid2";
import { createForm, valiForm } from "@modular-forms/solid";
import { boolean, minLength, object, string } from "valibot";
import { useReplicache } from "$/providers/replicache";
import { useNavigate } from "@solidjs/router";
import { IconXMark } from "$/ui/icons";
import { Stack, Row } from "$/ui/layout";
import { Modal } from "$/ui/modal";
import { theme } from "$/ui/theme";
import { Text } from "$/ui/text";
import { utility } from "$/ui/utility";
import { FormField, Input, inputFocusStyles } from "$/ui/form";
import { style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { Button, TextButton } from "$/ui/button";
import { For, Show, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { useAppContext } from "../context";

const Root = styled("div", {
  base: {
    width: theme.modalWidth.sm,
  },
});

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

const formStyle = style({
  ...utility.stack(7),
  padding: `${theme.space[6]} ${theme.space[5]} ${theme.space[4]}`,
  borderTop: `1px solid ${theme.color.divider.base}`,
});

const checkboxStyle = style({
  marginTop: 1,
});

const CheckboxRow = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "flex-start",
  },
});

const CheckboxCopy = styled("p", {
  base: {
    fontSize: theme.font.size.sm,
    color: theme.color.text.primary.base,
  },
});

const CheckboxDesc = styled("p", {
  base: {
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
  },
});

const Controls = styled("div", {
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

export type DialogDeployControl = ReturnType<typeof init>["control"];

export function DialogDeploy(props: {
  control: (control: DialogDeployControl) => void;
}) {
  const { state, control } = init();
  const rep = useReplicache();

  const ctx = useAppContext();
  const nav = useNavigate();
  const [form, { Form, Field }] = createForm({
    validate: valiForm(
      object({
        ref: string([minLength(1, "Enter a branch, tag, or commit hash")]),
        stage: string([minLength(1, "Enter a stage")]),
        force: boolean(),
      })
    ),
  });

  createEffect(() => {
    props.control(control);
  });

  return (
    <Modal onClose={() => control.hide()} show={state.show}>
      <Root>
        <Stack>
          <Header>
            <Title>Trigger a deploy</Title>
            <IconClose onClick={() => control.hide()}>
              <IconXMark />
            </IconClose>
          </Header>
          <Form
            class={formStyle}
            onSubmit={async (data) => {
              const id = createId();
              await rep().mutate.run_manual_deploy({
                id,
                appID: ctx.app.id,
                ref: data.ref,
                stageName: data.stage,
                force: data.force,
              });
              // TODO: Implement navigation
              control.hide();
              // nav(`./${id}`);
              // window.location.reload();
            }}
          >
            <Field name="ref">
              {(field, props) => (
                <FormField label="Git Ref">
                  <Input
                    {...props}
                    autofocus
                    type="text"
                    value={field.value || ""}
                    placeholder="Branch, tag, or commit hash"
                  />
                </FormField>
              )}
            </Field>
            <Field name="stage">
              {(field, props) => (
                <FormField label="Stage">
                  <Input
                    {...props}
                    type="text"
                    value={field.value || ""}
                    placeholder="Stage to deploy"
                  />
                </FormField>
              )}
            </Field>
            <Field name="force" type="boolean">
              {(field, props) => (
                <FormField>
                  <CheckboxRow>
                    <input
                      {...props}
                      type="checkbox"
                      class={checkboxStyle}
                      checked={field.value || false}
                    />
                    <Stack space="1.5">
                      <CheckboxCopy>Force deploy</CheckboxCopy>
                      <CheckboxDesc>Clear the cache and unlock the stage</CheckboxDesc>
                    </Stack>
                  </CheckboxRow>
                </FormField>
              )}
            </Field>
            <Controls>
              <TextButton onClick={() => control.hide()}>Cancel</TextButton>
              <Button color="success">Deploy</Button>
            </Controls>
          </Form>
        </Stack>
      </Root>
    </Modal>
  );
}

