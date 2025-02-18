import { Modal } from "@console/web/ui/modal";
import { utility } from "@console/web/ui/utility";
import { styled } from "@macaron-css/solid";
import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { DateTime } from "luxon";
import { DATETIME_LONG } from "@console/web/common/format";
import { LinkButton } from "@console/web/ui/button";
import { FormField, Input } from "@console/web/ui/form";
import { Stack, Row, Grower } from "@console/web/ui/layout";
import { theme } from "@console/web/ui/theme";
import { Text } from "@console/web/ui/text";
import { Button } from "@console/web/ui/button";

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

const Form = styled("form", {
  base: {
    width: theme.modalWidth.sm,
    padding: theme.space[5],
  },
});

const GraphicSpacer = styled("div", {
  base: {
    ...utility.row(0),
    width: theme.space[8],
    alignItems: "center",
    justifyContent: "center",
  },
});

const GraphicStem = styled("div", {
  base: {
    flex: 1,
    height: 2,
    backgroundColor: theme.color.divider.base,
  },
});

export type DialogRangeControl = ReturnType<typeof init>["control"];

const DATES = ["M/d/yyyy", "yyyy-M-d", "MMM d yyyy", "MMM d", "M/d", "M-d"];
const TIMES = ["h:m a", "h:ma", "h:m", "ha"];
const FORMATS = [...DATES, ...TIMES];

for (const d of DATES) {
  for (const t of TIMES) {
    FORMATS.push(`${d} ${t}`);
  }
}

export function DialogRange(props: {
  onSelect: (end: Date) => void;
  control: (control: DialogRangeControl) => void;
}) {
  const { state, control } = init();
  let end!: HTMLInputElement;

  createEffect(() => {
    if (state.show) {
      setStore("error", false);
      setTimeout(() => {
        setStore({});
        end.value = "";
        end.focus();
      }, 0);
    }
  });

  createEffect(() => {
    props.control(control);
  });

  const [store, setStore] = createStore<{
    parsed?: DateTime | undefined;
    error?: boolean;
  }>({});

  const now = DateTime.now();
  const placeholder = `${now.toFormat("h:mm a")}, ${now.toFormat("MMM dd ha")}, or ${now.toFormat("MM/dd/yyyy h:mm a")}`;

  return (
    <Modal onClose={() => control.hide()} show={state.show}>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          end.blur();
          if (!store.parsed) {
            end.focus();
            return;
          }
          props.onSelect(store.parsed.toJSDate());
          control.hide();
        }}
      >
        <Stack space="5">
          <Text size="lg" weight="medium">Jump to</Text>
          <Row space="1">
            <Grower>
              <FormField
                color={store.error ? "danger" : undefined}
                hint={
                  store.parsed
                    ? "Looking for logs after " +
                    store.parsed.toLocaleString(DATETIME_LONG) +
                    "."
                    : store.error
                      ? "Use a valid date format like " +
                      DateTime.now().toFormat("MM/dd/yyyy h:mm a") +
                      "."
                      : "Look for logs after the given date."
                }
              >
                <Input
                  ref={end}
                  name="end"
                  onInput={() => setStore("error", false)}
                  placeholder={placeholder}
                  onBlur={(e) => {
                    if (!e.currentTarget.value) return;
                    for (const f of FORMATS) {
                      const result = DateTime.fromFormat(
                        e.currentTarget.value,
                        f,
                      );
                      if (result?.isValid) {
                        setStore({
                          error: false,
                          parsed: result,
                        });
                        return;
                      }
                      setStore({
                        error: true,
                        parsed: undefined,
                      });
                    }
                  }}
                />
              </FormField>
            </Grower>
          </Row>
          <Row space="5" vertical="center" horizontal="end">
            <LinkButton onClick={() => control.hide()}>Cancel</LinkButton>
            <Button color="secondary">View Logs</Button>
          </Row>
        </Stack>
      </Form>
    </Modal>
  );
}
