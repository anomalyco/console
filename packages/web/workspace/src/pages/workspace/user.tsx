import { AvatarInitialsIcon } from "$/ui/avatar-icon";
import { styled } from "@macaron-css/solid";
import { useWorkspace } from "./context";
import { utility } from "$/ui/utility";
import { Input, FormField } from "$/ui/form";
import { createId } from "@paralleldrive/cuid2";
import { useReplicache } from "$/providers/replicache";
import { useNavigate } from "@solidjs/router";
import { Header } from "./header";
import {
  FormError,
  createForm,
  setError,
  submit,
  valiForm,
} from "@modular-forms/solid";
import { object, string, email, toLowerCase } from "valibot";
import { UserStore } from "$/data/user";
import { Fullscreen, Stack } from "$/ui/layout";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";

const FieldList = styled("form", {
  base: {
    width: 320,
    ...utility.stack(5),
  },
});

export function User() {
  const workspace = useWorkspace();
  const rep = useReplicache();
  const nav = useNavigate();
  const [form, { Form, Field }] = createForm({
    validate: valiForm(
      object({
        email: string(),
      }),
    ),
    validateOn: "input",
  });
  const users = UserStore.list.watch(rep, () => []);
  return (
    <>
      <Header />
      <Fullscreen>
        <Stack horizontal="center" space="5">
          <AvatarInitialsIcon type="workspace" text={workspace().slug} />
          <Stack horizontal="center" space="2">
            <Text size="lg" weight="medium">
              Invite a user to this workspace
            </Text>
            <Text color="secondary">
              Enter their email and we'll send an invite
            </Text>
          </Stack>
          <Form
            onSubmit={async (data) => {
              if (
                users().some((u) => !u.timeDeleted && u.email === data.email)
              ) {
                setError(form, "email", "User already invited.");
                return;
              }
              const id = createId();
              await rep().mutate.user_create({
                id,
                email: data.email,
              });
              nav(`/${workspace()?.slug}`);
            }}
          >
            <FieldList>
              <Field name="email">
                {(field, props) => (
                  <FormField
                    hint={field.error}
                    color={field.error ? "danger" : "primary"}
                  >
                    <Input
                      {...props}
                      autofocus
                      placeholder="user@example.com"
                    />
                  </FormField>
                )}
              </Field>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  submit(form);
                }}
                type="submit"
              >
                Send Invite
              </Button>
            </FieldList>
          </Form>
        </Stack>
      </Fullscreen>
    </>
  );
}
