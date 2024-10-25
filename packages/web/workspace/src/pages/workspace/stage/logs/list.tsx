import { For, Show, Match, Switch, createMemo, createSignal } from "solid-js";
import {
  IconFunction,
  IconGoRuntime,
  IconJavaRuntime,
  IconNodeRuntime,
  IconRustRuntime,
  IconPythonRuntime,
  IconDotNetRuntime,
  IconContainerRuntime,
} from "$/ui/icons/custom";
import { sortBy } from "remeda";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Dropdown } from "$/ui/dropdown";
import { styled } from "@macaron-css/solid";
import { useStageContext } from "../context";
import { StateResourceStore } from "$/data/app";
import type { State } from "@console/core/state";
import { Link, useNavigate } from "@solidjs/router";
import { Row, Stack, Fullscreen } from "$/ui/layout";
import { useReplicache } from "$/providers/replicache";
import { IconCheck, IconEllipsisVertical } from "$/ui/icons";
import { formatBytes, formatDuration } from "$/common/format";
import { Tag } from "$/ui/tag";

const Content = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const Card = styled("div", {
  base: {
    borderRadius: 4,
    backgroundColor: theme.color.background.surface,
  },
  variants: {
    outline: {
      true: {
        backgroundColor: "transparent",
        border: `1px solid ${theme.color.divider.base}`,
      },
    },
  },
});

const HeaderRoot = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${theme.space[4]}`,
    height: 50,
    gap: theme.space[6],
  },
});

const HeaderTitle = styled("span", {
  base: {
    color: theme.color.text.primary.surface,
    fontWeight: theme.font.weight.medium,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.primary.base,
      },
    },
  },
});

const Children = styled("div", {
  base: {
    ...utility.stack(0),
    padding: `0 ${theme.space[3]} 0 ${theme.space[4]}`,
    borderTop: `1px solid ${theme.color.divider.surface}`,
    ":empty": {
      display: "none",
    },
  },
  variants: {
    outline: {
      true: {
        borderColor: theme.color.divider.base,
      },
    },
  },
});

const Child = styled("div", {
  base: {
    ...utility.row(4),
    padding: `${theme.space[4]} 0`,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${theme.color.divider.surface}`,
    selectors: {
      "&:last-child": {
        border: "none",
      },
    },
  },
  variants: {
    outline: {
      true: {
        borderColor: theme.color.divider.base,
      },
    },
  },
});

const ChildColLeft = styled("div", {
  base: {
    ...utility.stack(1.5),
    minWidth: 0,
  },
});

const ChildColRight = styled("div", {
  base: {
    ...utility.row(6),
    flex: "0 0 auto",
    alignItems: "center",
  },
});

const ChildTitleLink = styled(Link, {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
  },
});

const ChildDesc = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    color: theme.color.text.secondary.surface,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.secondary.base,
      },
    },
  },
});

const ChildTagline = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.surface,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.dimmed.base,
      },
    },
  },
});

const ChildDetail = styled("div", {
  base: {
    ...utility.stack(1.5),
    width: 100,
  },
});

const ChildDetailLabel = styled("div", {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.surface,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.dimmed.base,
      },
    },
  },
});

const ChildDetailValue = styled("div", {
  base: {
    ...utility.text.line,
    display: "flex",
    alignItems: "baseline",
    color: theme.color.text.secondary.surface,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    textAlign: "right",
    lineHeight: "normal",
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.dimmed.base,
      },
    },
  },
});

const ChildDetailValueUnit = styled("span", {
  base: {
    fontSize: theme.font.size.xs,
  },
});

const ChildDetailLive = styled("div", {
  base: {
    width: 100,
  },
});

const ChildIcon = styled("div", {
  base: {
    flexShrink: 0,
    height: 20,
    width: 20,
    color: theme.color.icon.dimmed,
  },
});

const EmptyResourcesCopy = styled("span", {
  base: {
    fontSize: theme.font.size.lg,
    color: theme.color.text.dimmed.base,
  },
});

export function List() {
  const nav = useNavigate();
  const rep = useReplicache();
  const ctx = useStageContext();
  const resources = StateResourceStore.forStage.watch(rep, () => [
    ctx.stage.id,
  ]);

  const sorted = createMemo(() => sortFunctions(resources()));
  const functions = createMemo(() =>
    sortBy(sorted()[0], (fn) => fn.outputs.handler),
  );
  const internals = createMemo(() => sortBy(sorted()[1], (fn) => fn.name));

  function Runtime(props: { runtime?: string }) {
    return (
      <ChildIcon title={props.runtime}>
        <Switch>
          <Match when={props.runtime?.startsWith("dotnet")}>
            <IconDotNetRuntime />
          </Match>
          <Match when={props.runtime?.startsWith("python")}>
            <IconPythonRuntime />
          </Match>
          <Match when={props.runtime?.startsWith("java")}>
            <IconJavaRuntime />
          </Match>
          <Match when={props.runtime?.startsWith("go")}>
            <IconGoRuntime />
          </Match>
          <Match when={props.runtime?.startsWith("nodejs")}>
            <IconNodeRuntime />
          </Match>
          <Match when={props.runtime?.startsWith("rust")}>
            <IconRustRuntime />
          </Match>
          <Match when={props.runtime?.startsWith("container")}>
            <IconContainerRuntime />
          </Match>
          <Match when={true}>
            <IconFunction />
          </Match>
        </Switch>
      </ChildIcon>
    );
  }

  function renderBytes(size: number) {
    const formattedSize = formatBytes(size);
    return (
      <>
        {formattedSize.value}
        <ChildDetailValueUnit>{formattedSize.unit}</ChildDetailValueUnit>
      </>
    );
  }

  function renderFunction(fn: SortedResource, isInternal: boolean) {
    const live = () => fn.sst?.outputs["_live"];
    const [copying, setCopying] = createSignal(false);
    return (
      <Child outline={isInternal}>
        <ChildColLeft>
          <Row space="3" vertical="center">
            <ChildTitleLink
              href={`aws/logs?logGroup=${getLogGroup(fn)}&view=past`}
            >
              {isInternal
                ? fn.name
                : live()
                  ? live().handler
                  : fn.outputs.handler}
            </ChildTitleLink>
          </Row>
          <Show
            when={fn.root && (!isInternal || fn.root!.name !== fn.name)}
            fallback={
              <ChildTagline outline={isInternal}>{fn.type}</ChildTagline>
            }
          >
            <Row space="2">
              <ChildDesc outline={isInternal}>{fn.root!.name}</ChildDesc>
              <ChildTagline outline={isInternal}>{fn.root!.type}</ChildTagline>
            </Row>
          </Show>
        </ChildColLeft>
        <ChildColRight>
          <Show when={live()}>
            <ChildDetailLive>
              <Tag style="outline" level="tip" size="small">
                Live
              </Tag>
            </ChildDetailLive>
          </Show>
          <ChildDetail>
            <ChildDetailLabel outline={isInternal}>Timeout</ChildDetailLabel>
            <ChildDetailValue
              outline={isInternal}
              title={
                fn.outputs && fn.outputs.timeout && !live()
                  ? `${fn.outputs.timeout} seconds`
                  : undefined
              }
            >
              <Show
                when={fn.outputs && fn.outputs.timeout && !live()}
                fallback="—"
              >
                {formatDuration(fn.outputs.timeout * 1000)}
              </Show>
            </ChildDetailValue>
          </ChildDetail>
          <ChildDetail>
            <ChildDetailLabel outline={isInternal}>Bundle</ChildDetailLabel>
            <ChildDetailValue outline={isInternal}>
              <Show
                when={fn.outputs && fn.outputs.sourceCodeSize && !live()}
                fallback="—"
              >
                {renderBytes(fn.outputs.sourceCodeSize)}
              </Show>
            </ChildDetailValue>
          </ChildDetail>
          <Row space="3" vertical="center">
            <ChildDetail style={{ width: "75px" }}>
              <ChildDetailLabel outline={isInternal}>Memory</ChildDetailLabel>
              <ChildDetailValue outline={isInternal}>
                <Show when={fn.outputs && fn.outputs.memorySize} fallback="—">
                  {renderBytes(fn.outputs.memorySize * 1024 * 1024)}
                </Show>
              </ChildDetailValue>
            </ChildDetail>
            <Runtime runtime={live() ? live().runtime : fn.outputs.runtime} />
            <Dropdown
              size="sm"
              disabled={copying()}
              icon={
                copying() ? (
                  <IconCheck width={18} height={18} />
                ) : (
                  <IconEllipsisVertical width={18} height={18} />
                )
              }
            >
              <Dropdown.Item
                onSelect={() =>
                  nav(`../resources/${encodeURIComponent(fn.urn)}`)
                }
              >
                View Resource
              </Dropdown.Item>
              <Dropdown.Seperator />
              <Dropdown.Item
                onSelect={() => {
                  setCopying(true);
                  navigator.clipboard.writeText(fn.urn);
                  setTimeout(() => setCopying(false), 2000);
                }}
              >
                Copy URN
              </Dropdown.Item>
            </Dropdown>
          </Row>
        </ChildColRight>
      </Child>
    );
  }

  return (
    <Switch>
      <Match
        when={resources().length && (functions().length || internals().length)}
      >
        <Content>
          <Stack space="4">
            <Show when={functions().length}>
              <Card>
                <HeaderRoot>
                  <HeaderTitle>Functions</HeaderTitle>
                </HeaderRoot>
                <Children>
                  <For each={functions()}>
                    {(fn) => renderFunction(fn, false)}
                  </For>
                </Children>
              </Card>
            </Show>
            <Show when={internals().length}>
              <Card outline>
                <HeaderRoot>
                  <HeaderTitle outline>Internals</HeaderTitle>
                </HeaderRoot>
                <Children>
                  <For each={internals()}>
                    {(fn) => renderFunction(fn, true)}
                  </For>
                </Children>
              </Card>
            </Show>
          </Stack>
        </Content>
      </Match>
      <Match when={true}>
        <Fullscreen inset="header-tabs">
          <EmptyResourcesCopy>
            Deploy a function to get started!
          </EmptyResourcesCopy>
        </Fullscreen>
      </Match>
    </Switch>
  );
}

type SortedResource = State.Resource & {
  name: string;
  sst?: State.Resource;
  root?: SortedResource;
};
function sortFunctions(
  resources: State.Resource[],
): [SortedResource[], SortedResource[]] {
  // Create a map to store each object by its urn
  const idMap: { [key: string]: SortedResource } = {};

  resources.forEach((r) => {
    idMap[r.urn] = { ...r, name: getResourceName(r.urn)! };
  });

  const functions: SortedResource[] = [];
  const internals: SortedResource[] = [];

  // Look for lambda functions with log groups
  resources.forEach((r) => {
    if (r.type !== "aws:lambda/function:Function") {
      return;
    }

    const logGroup = getLogGroup(r);

    if (!logGroup) {
      return;
    }

    // Find the root component
    const root = getRoot(idMap[r.urn]);

    const fn: SortedResource = {
      ...r,
      sst: undefined,
      name: getResourceName(r.urn)!,
      root: root.urn === r.urn ? undefined : root,
    };

    const parent = r.parent && idMap[r.parent];

    // If the parent is an SST function
    if (parent && parent.type === "sst:aws:Function") {
      fn.name = getResourceName(parent.urn)!;
      fn.sst = { ...parent };

      // Check if the parent is not an internal function
      if (!isInternalFunction(parent, root)) {
        functions.push(fn);
        return;
      }
    }

    internals.push(fn);
  });

  function getRoot(fn: SortedResource): SortedResource {
    if (!fn.parent) {
      return fn;
    }

    const parent = idMap[fn.parent];

    if (!parent || parent.type === "pulumi:pulumi:Stack") {
      return fn;
    }

    return getRoot(parent);
  }

  return [functions, internals];
}

function getResourceName(urn: string) {
  return urn.split("::").at(-1);
}

function getLogGroup(fn: State.Resource) {
  return fn.outputs &&
    fn.outputs.loggingConfig &&
    fn.outputs.loggingConfig.logGroup
    ? fn.outputs.loggingConfig.logGroup
    : undefined;
}

function isInternalFunction(fn: State.Resource, root?: SortedResource) {
  return (
    (root &&
      (root!.type === "sst:aws:Nuxt" ||
        root.type === "sst:aws:Astro" ||
        root!.type === "sst:aws:Nextjs" ||
        root!.type === "sst:aws:Remix" ||
        root.type === "sst:aws:SolidStart" ||
        root.type === "sst:aws:SvelteKit")) ||
    (fn.outputs &&
      fn.outputs["_metadata"] &&
      fn.outputs["_metadata"].internal &&
      fn.outputs["_metadata"].internal === true)
  );
}
