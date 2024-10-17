import {
  Text,
  Input,
  theme,
  Stack,
  Button,
  utility,
  FormField,
  Fullscreen,
  AvatarInitialsIcon,
} from "$/ui";
import { styled } from "@macaron-css/solid";
import { createForm, getValue, setError, valiForm } from "@modular-forms/solid";
import { useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import { minLength, object, string, regex } from "valibot";
import { Header } from "./workspace/header";
import { useAuth2 } from "$/providers/auth2";
import { Workspace } from "@console/core/workspace";

const CreateWorkspaceHint = styled("ul", {
  base: {
    ...utility.stack(2.5),
    width: "100%",
    padding: `${theme.space[4]} ${theme.space[3]} ${theme.space[4]} 30px`,
    listStyle: "circle",
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
  },
});

const FieldList = styled("div", {
  base: {
    width: 320,
    ...utility.stack(5),
  },
});

export function WorkspaceCreate() {
  const [form, { Form, Field }] = createForm({
    validate: valiForm(
      object({
        slug: string([
          minLength(3, "Must be at least 3 characters long."),
          regex(/^[a-z0-9\-]+$/, "Must be lowercase, URL friendly."),
        ]),
      }),
    ),
  });
  const auth = useAuth2();
  const nav = useNavigate();

  return (
    <>
      <Header />
      <Fullscreen inset="header">
        <Stack space="5">
          <Stack horizontal="center" space="5">
            <AvatarInitialsIcon
              type="workspace"
              text={getValue(form, "slug") || "-"}
            />
            <Stack horizontal="center" space="2">
              <Text size="lg" weight="medium">
                Create a new workspace
              </Text>
              <Text color="secondary" on="base">
                Start by giving your workspace a name
              </Text>
            </Stack>
            <CreateWorkspaceHint>
              <li>Create a workspace for your organization</li>
              <li>Invite your team & connect your accounts</li>
            </CreateWorkspaceHint>
          </Stack>
          <Form
            onSubmit={async (data) => {
              console.log("submitting");
              const result = await fetch(
                import.meta.env.VITE_API_URL + "/account/workspace",
                {
                  method: "POST",
                  headers: {
                    authorization: `Bearer ${auth.current.token}`,
                    "content-type": "application/json",
                  },
                  body: JSON.stringify(data),
                },
              );
              if (!result.ok) {
                setError(form, "slug", "Workspace name is taken.");
                return;
              }
              await auth.refresh();
              const workspace = (await result.json()) as Workspace.Info;
              nav(`/${workspace.slug}`);
            }}
          >
            <FieldList>
              <Field name="slug">
                {(field, props) => (
                  <FormField
                    hint={
                      field.error
                        ? field.error
                        : "Needs to be lowercase, unique, and URL friendly."
                    }
                    color={field.error ? "danger" : "primary"}
                  >
                    <Input
                      {...props}
                      autofocus
                      placeholder="your-company-name"
                    />
                  </FormField>
                )}
              </Field>
              <Button type="submit" disabled={form.submitting}>
                <Show when={form.submitting} fallback="Create Workspace">
                  Creating&hellip;
                </Show>
              </Button>
            </FieldList>
          </Form>
        </Stack>
      </Fullscreen>
    </>
  );
}
