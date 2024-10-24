import {
  For,
  JSX,
  Show,
  Match,
  Switch,
  Component,
  createMemo,
  createSignal,
  ComponentProps,
} from "solid-js";
import {
  useFunctionsContext,
  useResourcesContext,
  useStageContext,
  useStateResources,
} from "../context";
import { styled } from "@macaron-css/solid";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Dropdown } from "$/ui/dropdown";
import { Fullscreen, Row, Stack } from "$/ui/layout";
import {
  IconApi,
  IconRDS,
  IconAuth,
  IconCron,
  IconStack,
  IconTable,
  IconTopic,
  IconQueue,
  IconBucket,
  IconAppSync,
  IconCognito,
  IconEventBus,
  IconFunction,
  IconConstruct,
  IconGoRuntime,
  IconRemixSite,
  IconAstroSite,
  IconNextjsSite,
  IconStaticSite,
  IconJavaRuntime,
  IconNodeRuntime,
  IconRustRuntime,
  IconWebSocketApi,
  IconPythonRuntime,
  IconDotNetRuntime,
  IconSvelteKitSite,
  IconSolidStartSite,
  IconContainerRuntime,
} from "$/ui/icons/custom";
import { Resource } from "@console/core/app/resource";
import type { State } from "@console/core/state";
import { Link } from "@solidjs/router";
import { Syncing } from "$/ui/loader";
import {
  IconCheck,
  IconChevronRight,
  IconEllipsisVertical,
  IconDocumentDuplicate,
} from "$/ui/icons";
import { UpdateStatusIcon } from "./updates/list";
import { sortBy } from "remeda";
import { Dynamic } from "solid-js/web";
import {} from "@solid-primitives/keyboard";
import { formatBytes, formatSinceTime } from "$/common/format";
import { ResourceIcon } from "$/common/resource-icon";
import { createSubscription } from "$/providers/replicache";
import { StateUpdateStore } from "$/data/app";
import { DateTime } from "luxon";
import { TextButton } from "$/ui/button";
import { Tag } from "$/ui/tag";
import { Text } from "$/ui/text";

const ION_ICON_MAP: { [key: string]: Component } = {
  "sst:aws:Auth": IconAuth,
  "sst:aws:Cron": IconCron,
  "sst:aws:Router": IconApi,
  // "sst:aws:Job": IconJob,
  "sst:aws:Queue": IconQueue,
  "sst:aws:Postgres": IconRDS,
  "sst:aws:Dynamo": IconTable,
  "sst:aws:Bus": IconEventBus,
  "sst:aws:Bucket": IconBucket,
  "sst:aws:SnsTopic": IconTopic,
  "sst:aws:Astro": IconAstroSite,
  "sst:aws:Nuxt": IconStaticSite,
  "sst:aws:Remix": IconRemixSite,
  "sst:aws:AppSync": IconAppSync,
  "sst:aws:ApiGatewayV2": IconApi,
  // "sst:aws:Script": IconScript,
  "sst:aws:Function": IconFunction,
  "sst:aws:Nextjs": IconNextjsSite,
  "sst:aws:Realtime": IconWebSocketApi,
  "sst:aws:StaticSite": IconStaticSite,
  "sst:aws:SvelteKit": IconSvelteKitSite,
  "sst:aws:CognitoUserPool": IconCognito,
  "sst:aws:SolidStart": IconSolidStartSite,
  "sst:aws:CognitoIdentityPool": IconCognito,
  // "sst:aws:KinesisStream": IconKinesisStream,
  "sst:aws:ApiGatewayWebSocket": IconWebSocketApi,
  // "sst:aws:ApiGatewayV1Api": IconApiGatewayV1Api,
  "pulumi:pulumi:Stack": IconStack,
};

const Content = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const TitleRoot = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.space[1.5],
  },
});

const TitleRow = styled("div", {
  base: {
    ...utility.row(3),
    alignItems: "center",
  },
});

const TitleText = styled("div", {
  base: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
  },
});

const TitleDescLink = styled(Link, {
  base: {
    marginLeft: `calc(${theme.space[3]} + 12px)`,
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
    ":hover": {
      color: theme.color.text.secondary.base,
    },
  },
});

const TitleDescIcon = styled("div", {
  base: {
    top: 2,
    position: "relative",
    opacity: theme.iconOpacity,
  },
});

export const PageHeaderRoot = styled("div", {
  base: {
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${theme.space[4]}`,
    borderBottom: `1px solid ${theme.color.divider.base}`,
  },
});

const EmptyResourcesCopy = styled("span", {
  base: {
    fontSize: theme.font.size.lg,
    color: theme.color.text.dimmed.base,
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
    padding: `0 ${theme.space[3]}`,
    height: 50,
    gap: theme.space[6],
  },
});

const HeaderIcon = styled("div", {
  base: {
    flexShrink: 0,
    width: 18,
    height: 18,
    color: theme.color.icon.secondary,
  },
  variants: {
    outline: {
      true: {
        opacity: theme.iconOpacity,
      },
    },
  },
});

const HeaderTitle = styled("span", {
  base: {
    ...utility.text.line,
    minWidth: 0,
    color: theme.color.text.primary.surface,
    fontWeight: theme.font.weight.medium,
    lineHeight: "normal",
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.primary.base,
      },
    },
  },
});

const HeaderTitleTagline = styled("span", {
  base: {
    color: theme.color.text.secondary.surface,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.secondary.base,
      },
    },
  },
});

const HeaderTitleTaglineLink = styled(Link, {
  base: {
    ...utility.text.line,
    minWidth: 0,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    lineHeight: "normal",
  },
});

const HeaderDescription = styled("span", {
  base: {
    ...utility.text.line,
    minWidth: 0,
    maxWidth: 500,
    lineHeight: "normal",
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

const HeaderDescriptionLink = styled("a", {
  base: {
    ...utility.text.line,
    minWidth: 0,
    maxWidth: 500,
    lineHeight: "normal",
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

const Children = styled("div", {
  base: {
    ...utility.stack(0),
    padding: `0 ${theme.space[3]}`,
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

const OutputsEmpty = styled("div", {
  base: {
    height: 140,
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.color.text.dimmed.surface,
  },
});

export const Child = styled("div", {
  base: {
    padding: `${theme.space[4]} 0`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space[4],
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

export const ChildTitleLink = styled(Link, {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
  },
});

export const ChildTitle = styled("span", {
  base: {
    ...utility.text.line,
  },
});

export const ChildDetail = styled("div", {
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
});

export const ChildDetailUnit = styled("span", {
  base: {
    padding: 3,
    fontSize: theme.font.size.xs,
  },
});

export const ChildIcon = styled("div", {
  base: {
    flexShrink: 0,
    height: 16,
    width: 16,
    color: theme.color.icon.dimmed,
  },
});

export const ChildIconButton = styled("button", {
  base: {
    flexShrink: 0,
    height: 16,
    width: 16,
    color: theme.color.icon.dimmed,
    ":hover": {
      color: theme.color.icon.secondary,
    },
  },
  variants: {
    copying: {
      true: {
        cursor: "default",
        color: theme.color.icon.dimmed,
        ":hover": {
          color: theme.color.icon.dimmed,
        },
      },
    },
  },
});

const ChildValue = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.surface,
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

const ChildValueMono = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    color: theme.color.text.dimmed.surface,
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

const ChildKey = styled("span", {
  base: {
    ...utility.text.line,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.primary.surface,
    lineHeight: "normal",
    minWidth: "33%",
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.primary.base,
      },
    },
  },
});

const ChildKeyLink = styled(Link, {
  base: {
    ...utility.text.line,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    lineHeight: "normal",
    minWidth: "33%",
  },
});

function cleanFilepath(path: string) {
  if (!path) return;
  return path.replace(/^\.?\//, "");
}

function isValidHttpUrl(string: string): boolean {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

function getUrl(url?: string, customDomainUrl?: string) {
  return customDomainUrl ? customDomainUrl : url ? url : undefined;
}

function getFunctionById(resources: Resource.Info[], id: string) {
  return resources.find(
    (r) =>
      r.type === "Function" &&
      (r.id === id || r.addr === id || r.metadata.arn === id),
  ) as Extract<Resource.Info, { type: "Function" }> | undefined;
}

function resourcePriority(resource: Resource.Info) {
  switch (resource.type) {
    case "RemixSite":
    case "AstroSite":
    case "NextjsSite":
    case "SvelteKitSite":
    case "SolidStartSite":
      return 1;
    case "Api":
    case "AppSync":
    case "ApiGatewayV1Api":
      return 2;
    case "WebSocketApi":
      return 3;
    case "StaticSite":
      return 4;
    case "Bucket":
      return 5;
    case "RDS":
    case "Table":
      return 6;
    case "Cron":
      return 8;
    case "EventBus":
      return 8;
    case "Queue":
    case "Topic":
    case "KinesisStream":
      return 9;
    case "Cognito":
      return 10;
    case "Script":
      return 11;
    default:
      return 100;
  }
}

function stateResourcePriority(resource: SortedStateResource) {
  switch (resource.type) {
    case "sst:aws:Nuxt":
    case "sst:aws:Remix":
    case "sst:aws:Astro":
    case "sst:aws:Nextjs":
    case "sst:aws:SvelteKit":
    case "sst:aws:SolidStart":
      return 1;
    case "sst:aws:StaticSite":
      return 2;
    case "sst:aws:Auth":
    case "sst:aws:Router":
    case "sst:aws:Realtime":
    case "sst:aws:ApiGatewayV2":
      return 3;
    case "sst:aws:Function":
      return 4;
    case "sst:aws:Bucket":
      return 5;
    case "sst:aws:Dynamo":
    case "sst:aws:Postgres":
      return 6;
    case "sst:aws:Cron":
      return 7;
    case "sst:aws:Bus":
      return 8;
    case "sst:aws:Queue":
    case "sst:aws:SnsTopic":
      return 9;
    case "sst:aws:AppSync":
    case "sst:aws:ApiGatewayWebSocket":
      return 10;
    case "sst:aws:CognitoUserPool":
    case "sst:aws:CognitoIdentityPool":
      return 11;
    case "pulumi:pulumi:Stack":
      return 101;
    default:
      if (resource.type.startsWith("pulumi:providers:")) {
        return 101;
      } else {
        return 100;
      }
  }
}

type SortedStateResource = State.Resource & {
  name: string;
  children: SortedStateResource[];
};
function sortStateResources(
  resources: State.Resource[],
): SortedStateResource[] {
  // Initialize an array to store root objects
  const roots: SortedStateResource[] = [];
  // Create a map to store each object by its urn
  const idMap: { [key: string]: SortedStateResource } = {};

  resources.forEach((r) => {
    idMap[r.urn] = { ...r, name: r.urn.split("::").at(-1)!, children: [] };
  });

  resources.forEach((r) => {
    if (r.parent === undefined) {
      // If the object has no parent, it is a root object
      roots.push(idMap[r.urn]);
    } else {
      // If the object is a direct child of the stack, it is a root object
      if (idMap[r.parent].type === "pulumi:pulumi:Stack") {
        roots.push(idMap[r.urn]);
      }
      // If the object has a parent, add it to the parent's children array
      if (idMap[r.parent]) {
        idMap[r.parent].children.push(idMap[r.urn]);
      }
    }
  });

  // Function to recursively collect all descendants
  function collectDescendants(r: SortedStateResource) {
    // If the object is a stack, it has no children
    if (r.type === "pulumi:pulumi:Stack") {
      return [];
    }

    let allChildren = [...r.children];
    r.children.forEach((child) => {
      if (idMap[child.urn]) {
        allChildren = allChildren.concat(collectDescendants(child));
      }
    });
    return sortBy(allChildren, (r) => r.name);
  }

  // Update each object to have a flattened list of all descendants
  Object.values(idMap).forEach((r) => {
    r.children = collectDescendants(r);
  });

  return sortBy(
    roots,
    (r) => stateResourcePriority(r),
    (r) => r.name,
  );
}

function sortResources(resources: Resource.Info[]): Resource.Info[] {
  const displayResources = resources.filter(
    (r) =>
      r.type === "Api" ||
      r.type === "RDS" ||
      r.type === "Cron" ||
      r.type === "Table" ||
      r.type === "Queue" ||
      r.type === "Topic" ||
      r.type === "Bucket" ||
      r.type === "Script" ||
      r.type === "Cognito" ||
      r.type === "AppSync" ||
      r.type === "EventBus" ||
      r.type === "AstroSite" ||
      r.type === "RemixSite" ||
      r.type === "StaticSite" ||
      r.type === "NextjsSite" ||
      r.type === "WebSocketApi" ||
      r.type === "KinesisStream" ||
      r.type === "SvelteKitSite" ||
      r.type === "SolidStartSite" ||
      r.type === "ApiGatewayV1Api",
  );

  return displayResources.sort((a, b) => {
    const priority = resourcePriority(a) - resourcePriority(b);
    return priority === 0
      ? a.type === b.type
        ? a.cfnID > b.cfnID
          ? 1
          : -1
        : a.type > b.type
          ? 1
          : -1
      : priority;
  });
}

type PageHeaderProps = ComponentProps<typeof PageHeaderRoot> & {
  right?: JSX.Element;
};

export function PageHeader(props: PageHeaderProps) {
  return (
    <PageHeaderRoot {...props}>
      <Row space="5" vertical="center">
        {props.children}
      </Row>
      {props.right}
    </PageHeaderRoot>
  );
}

interface HeaderProps {
  resource: Resource.Info;
  icon?: (props: any) => JSX.Element;
  link?: string;
  description?: string;
}

export function Header(props: HeaderProps) {
  const icon = createMemo(
    () =>
      props.icon ||
      ResourceIcon[props.resource.type as keyof typeof ResourceIcon],
  );
  return (
    <HeaderRoot>
      <Row space="2" vertical="center">
        <Row space="2" vertical="center">
          <Show when={icon}>
            {(icon) => (
              <HeaderIcon title={props.resource.type}>
                {icon()()({})}
              </HeaderIcon>
            )}
          </Show>
          <Text on="surface" weight="medium" style={{ "flex-shrink": "0" }}>
            {props.resource.type}
          </Text>
        </Row>
        <Text code color="secondary" size="mono_base" on="surface">
          {props.resource.cfnID}
        </Text>
      </Row>
      <HeaderDescription>
        <Show when={props.link} fallback={props.description}>
          <HeaderDescriptionLink
            target="_blank"
            href={props.link}
            rel="noopener noreferrer"
          >
            {props.description}
          </HeaderDescriptionLink>
        </Show>
      </HeaderDescription>
    </HeaderRoot>
  );
}

export function List() {
  const ctx = useStageContext();
  const functions = useFunctionsContext();
  const resources = useResourcesContext();
  const sortedResources = createMemo(() => sortResources([...resources()]));
  const latestUpdate = createSubscription(async (tx) => {
    const updates = await StateUpdateStore.forStage(tx, ctx.stage.id);
    const latest = updates.sort((a, b) => b.index - a.index)[0];
    return latest;
  });

  const orphans = createMemo(() =>
    sortBy(
      [...functions().entries()]
        .filter(([_, values]) => !values.length)
        .map(([key]) => key),
      (id) => (getFunctionById(resources(), id)?.enrichment?.size ? 0 : 1),
      (id) => getFunctionById(resources(), id)?.metadata.handler || "",
    ),
  );

  const outputs = createMemo(() =>
    resources()
      .flatMap((r) => (r.type === "Stack" ? r.enrichment.outputs : []))
      .sort((a, b) => a.OutputKey!.localeCompare(b.OutputKey!))
      .filter((o) => (o?.OutputValue?.trim() ?? "") !== ""),
  );

  const stateResources = useStateResources();
  const SortedStateResource = createMemo(() =>
    sortStateResources([...stateResources()]),
  );
  const stateOutputs = createMemo(() => {
    const outputs: { key: string; value: string }[] = [];

    SortedStateResource().forEach((r) => {
      if (r.type === "pulumi:pulumi:Stack") {
        Object.keys(r.outputs).forEach((key) => {
          if (typeof r.outputs[key] === "string") {
            outputs.push({ key, value: r.outputs[key] });
          }
        });
      } else if (r.type.startsWith("sst:")) {
        Object.keys(r.outputs).forEach((key) => {
          if (key === "_hint") {
            outputs.push({ key: r.name, value: r.outputs[key] });
          }
        });
      }
    });
    console.log({ outputs });

    return sortBy(outputs, (o) => o.key);
  });

  function renderOrphanFunctions() {
    return (
      <Show when={orphans().length}>
        <Card>
          <HeaderRoot>
            <Row space="2" vertical="center">
              <HeaderIcon title="Functions">
                <IconFunction />
              </HeaderIcon>
              <Text weight="medium" on="surface" style={{ "flex-shrink": "0" }}>
                Other Functions
              </Text>
            </Row>
          </HeaderRoot>
          <Children>
            <For each={orphans()}>
              {(orphan) => <FunctionChild id={orphan} />}
            </For>
          </Children>
        </Card>
      </Show>
    );
  }

  function renderOutputs() {
    return (
      <Show when={outputs().length}>
        <Card outline>
          <HeaderRoot>
            <Text weight="medium" style={{ "flex-shrink": "0" }}>
              Outputs
            </Text>
          </HeaderRoot>
          <Children outline>
            <For each={outputs()}>
              {(output) => {
                const [copying, setCopying] = createSignal(false);
                return (
                  <Show
                    when={
                      output?.OutputValue && output.OutputValue?.trim() !== ""
                    }
                  >
                    <Child outline>
                      <ChildKey>{output.OutputKey}</ChildKey>
                      <Row space="3" vertical="center">
                        <ChildValueMono>{output.OutputValue}</ChildValueMono>
                        <ChildIconButton
                          copying={copying()}
                          onClick={() => {
                            setCopying(true);
                            navigator.clipboard.writeText(output.OutputValue!);
                            setTimeout(() => setCopying(false), 2000);
                          }}
                        >
                          <Show when={!copying()} fallback={<IconCheck />}>
                            <IconDocumentDuplicate />
                          </Show>
                        </ChildIconButton>
                      </Row>
                    </Child>
                  </Show>
                );
              }}
            </For>
          </Children>
        </Card>
      </Show>
    );
  }

  function renderStateOutputs() {
    return (
      <Show
        when={stateOutputs().length}
        fallback={<OutputsEmpty>No outputs</OutputsEmpty>}
      >
        <Card>
          <HeaderRoot>
            <HeaderTitle>Outputs</HeaderTitle>
          </HeaderRoot>
          <Children>
            <For each={stateOutputs()}>
              {(output) => {
                const [copying, setCopying] = createSignal(false);
                return (
                  <Show
                    when={
                      output.value &&
                      typeof output.value === "string" &&
                      output.value.trim() !== ""
                    }
                  >
                    <Child>
                      <ChildKey>{output.key}</ChildKey>
                      <Row space="3" vertical="center">
                        <ChildValueMono>{output.value}</ChildValueMono>
                        <ChildIconButton
                          copying={copying()}
                          onClick={() => {
                            setCopying(true);
                            navigator.clipboard.writeText(output.value!);
                            setTimeout(() => setCopying(false), 2000);
                          }}
                        >
                          <Show when={!copying()} fallback={<IconCheck />}>
                            <IconDocumentDuplicate />
                          </Show>
                        </ChildIconButton>
                      </Row>
                    </Child>
                  </Show>
                );
              }}
            </For>
          </Children>
        </Card>
      </Show>
    );
  }

  function renderStateResource(resource: SortedStateResource) {
    const hint = resource.outputs["_hint"]
      ? (resource.outputs["_hint"] as string)
      : undefined;
    return (
      <Card outline>
        <HeaderRoot>
          <Row space="2" vertical="center">
            <HeaderIcon outline>
              <Show
                fallback={<IconConstruct />}
                when={ION_ICON_MAP.hasOwnProperty(resource.type)}
              >
                <Dynamic component={ION_ICON_MAP[resource.type]} />
              </Show>
            </HeaderIcon>
            <HeaderTitle>{resource.type}</HeaderTitle>
            <HeaderTitleTaglineLink href={encodeURIComponent(resource.urn)}>
              {resource.name}
            </HeaderTitleTaglineLink>
          </Row>
          <Show when={hint}>
            <Show
              when={isValidHttpUrl(hint!)}
              fallback={<HeaderDescription outline>{hint}</HeaderDescription>}
            >
              <HeaderDescriptionLink
                href={hint}
                target="_blank"
                rel="noopener noreferrer"
              >
                {hint}
              </HeaderDescriptionLink>
            </Show>
          </Show>
        </HeaderRoot>
        <Children outline>
          <For each={resource.children}>
            {(child) => {
              const [copying, setCopying] = createSignal(false);
              return (
                <Child outline>
                  <ChildKeyLink href={encodeURIComponent(child.urn)}>
                    {child.name}
                  </ChildKeyLink>
                  <Row space="3" vertical="center">
                    <ChildValue outline>{child.type}</ChildValue>
                    <Dropdown
                      size="sm"
                      disabled={copying()}
                      icon={
                        copying() ? (
                          <IconCheck width={16} height={16} />
                        ) : (
                          <IconEllipsisVertical width={16} height={16} />
                        )
                      }
                    >
                      <Dropdown.Item
                        onSelect={() => {
                          setCopying(true);
                          navigator.clipboard.writeText(child.urn);
                          setTimeout(() => setCopying(false), 2000);
                        }}
                      >
                        Copy URN
                      </Dropdown.Item>
                    </Dropdown>
                  </Row>
                </Child>
              );
            }}
          </For>
        </Children>
      </Card>
    );
  }

  return (
    <Switch>
      <Match when={!resources().length && !stateResources().length}>
        <Fullscreen inset="header-tabs">
          <Syncing>Waiting for resources&hellip;</Syncing>
        </Fullscreen>
      </Match>
      <Match when={true}>
        <Switch>
          <Match when={stateResources().length}>
            <Content>
              <Stack space="6">
                <Show when={latestUpdate.value}>
                  <TitleRoot>
                    <Stack space="2.5">
                      <TitleRow>
                        <Switch>
                          <Match when={!latestUpdate.value!.time.completed}>
                            <UpdateStatusIcon status="updating" />
                          </Match>
                          <Match
                            when={
                              latestUpdate.value?.time.completed &&
                              latestUpdate.value?.errors.length === 0
                            }
                          >
                            <UpdateStatusIcon status="updated" />
                          </Match>
                          <Match when={latestUpdate.value?.errors.length}>
                            <UpdateStatusIcon status="error" />
                          </Match>
                        </Switch>
                        <TitleText>{ctx.stage.name}</TitleText>
                      </TitleRow>
                      <TitleDescLink href={`updates/${latestUpdate.value!.id}`}>
                        Updated{" "}
                        {formatSinceTime(
                          DateTime.fromISO(
                            latestUpdate.value!.time.updated,
                          ).toSQL()!,
                          true,
                        )}
                      </TitleDescLink>
                    </Stack>
                    <Link href="updates">
                      <TextButton>
                        <Row space="0.5" horizontal="center">
                          View history
                          <TitleDescIcon>
                            <IconChevronRight width="13" height="13" />
                          </TitleDescIcon>
                        </Row>
                      </TextButton>
                    </Link>
                  </TitleRoot>
                </Show>
                <Stack space="5">
                  {renderStateOutputs()}
                  <For each={SortedStateResource()}>{renderStateResource}</For>
                </Stack>
              </Stack>
            </Content>
          </Match>
          <Match when={true}>
            <Content>
              <Stack space="4">
                <Show
                  when={
                    sortedResources().length ||
                    orphans().length ||
                    outputs().length
                  }
                  fallback={
                    <Fullscreen inset="header-tabs">
                      <EmptyResourcesCopy>
                        Deploy some resources to get started!
                      </EmptyResourcesCopy>
                    </Fullscreen>
                  }
                >
                  <For each={sortedResources()}>
                    {(resource) => (
                      <Card>
                        <Switch>
                          <Match when={resource.type === "Api" && resource}>
                            {(resource) => <ApiCard resource={resource()} />}
                          </Match>
                          <Match
                            when={
                              resource.type === "ApiGatewayV1Api" && resource
                            }
                          >
                            {(resource) => (
                              <ApiGatewayV1ApiCard resource={resource()} />
                            )}
                          </Match>
                          <Match when={resource.type === "AppSync" && resource}>
                            {(resource) => (
                              <AppSyncCard resource={resource()} />
                            )}
                          </Match>
                          <Match
                            when={resource.type === "WebSocketApi" && resource}
                          >
                            {(resource) => (
                              <WebSocketApiCard resource={resource()} />
                            )}
                          </Match>
                          <Match
                            when={resource.type === "NextjsSite" && resource}
                          >
                            {(resource) => (
                              <NextjsSiteCard resource={resource()} />
                            )}
                          </Match>
                          <Match
                            when={resource.type === "SvelteKitSite" && resource}
                          >
                            {(resource) => (
                              <SvelteKitSiteCard resource={resource()} />
                            )}
                          </Match>
                          <Match
                            when={resource.type === "AstroSite" && resource}
                          >
                            {(resource) => (
                              <AstroSiteCard resource={resource()} />
                            )}
                          </Match>
                          <Match
                            when={resource.type === "RemixSite" && resource}
                          >
                            {(resource) => (
                              <RemixSiteCard resource={resource()} />
                            )}
                          </Match>
                          <Match
                            when={
                              resource.type === "SolidStartSite" && resource
                            }
                          >
                            {(resource) => (
                              <SolidStartSiteCard resource={resource()} />
                            )}
                          </Match>
                          <Match
                            when={resource.type === "StaticSite" && resource}
                          >
                            {(resource) => (
                              <StaticSiteCard resource={resource()} />
                            )}
                          </Match>
                          <Match when={resource.type === "Table" && resource}>
                            {(resource) => <TableCard resource={resource()} />}
                          </Match>
                          <Match when={resource.type === "RDS" && resource}>
                            {(resource) => <RDSCard resource={resource()} />}
                          </Match>
                          <Match
                            when={resource.type === "EventBus" && resource}
                          >
                            {(resource) => (
                              <EventBusCard resource={resource()} />
                            )}
                          </Match>
                          <Match when={resource.type === "Topic" && resource}>
                            {(resource) => <TopicCard resource={resource()} />}
                          </Match>
                          <Match
                            when={resource.type === "KinesisStream" && resource}
                          >
                            {(resource) => (
                              <KinesisStreamCard resource={resource()} />
                            )}
                          </Match>
                          <Match when={resource.type === "Queue" && resource}>
                            {(resource) => <QueueCard resource={resource()} />}
                          </Match>
                          <Match when={resource.type === "Bucket" && resource}>
                            {(resource) => <BucketCard resource={resource()} />}
                          </Match>
                          <Match when={resource.type === "Cognito" && resource}>
                            {(resource) => (
                              <CognitoCard resource={resource()} />
                            )}
                          </Match>
                          <Match when={resource.type === "Cron" && resource}>
                            {(resource) => <CronCard resource={resource()} />}
                          </Match>
                          <Match when={resource.type === "Script" && resource}>
                            {(resource) => <ScriptCard resource={resource()} />}
                          </Match>
                        </Switch>
                      </Card>
                    )}
                  </For>
                  {renderOrphanFunctions()}
                  {renderOutputs()}
                </Show>
              </Stack>
            </Content>
          </Match>
        </Switch>
      </Match>
    </Switch>
  );
}

function formatPath(path?: string) {
  return path ? (path === "." ? `"${path}"` : path) : `""`;
}

interface CardProps<Type extends Resource.Info["type"]> {
  resource: Extract<Resource.Info, { type: Type }>;
}

export function ApiCard(props: CardProps<"Api">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          ""
        }
      />
      {props.resource.metadata.routes.length > 0 && (
        <Children>
          <For each={props.resource.metadata.routes}>
            {(route) => {
              const method = createMemo(() => route.route.split(" ")[0]);
              const path = createMemo(() => route.route.split(" ")[1]);
              return (
                <FunctionChild
                  tag={method()}
                  title={path()}
                  tagSize="small"
                  id={route.fn?.node}
                />
              );
            }}
          </For>
        </Children>
      )}
    </>
  );
}

export function WebSocketApiCard(props: CardProps<"WebSocketApi">) {
  const sortedRoutes = createMemo(() =>
    sortBy((route: any) => route.route.slice(1).length)(
      props.resource.metadata.routes || [],
    ),
  );
  return (
    <>
      <Header
        resource={props.resource}
        description={
          props.resource.metadata.customDomainUrl || props.resource.metadata.url
        }
      />
      <Children>
        <For each={sortedRoutes()}>
          {(route: any) => {
            const method = createMemo(() => route.route.slice(1));
            const path = createMemo(() => route.route.split(" ")[1]);
            return (
              <FunctionChild
                tag={method()}
                title={path()}
                tagSize="auto"
                id={route.fn?.node}
              />
            );
          }}
        </For>
      </Children>
    </>
  );
}

export function ApiGatewayV1ApiCard(props: CardProps<"ApiGatewayV1Api">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          ""
        }
      />
      <Children>
        <For each={props.resource.metadata.routes}>
          {(route) => {
            const method = createMemo(() => route.route.split(" ")[0]);
            const path = createMemo(() => route.route.split(" ")[1]);
            return (
              <FunctionChild
                tag={method()}
                title={path()}
                tagSize="small"
                id={route.fn?.node}
              />
            );
          }}
        </For>
      </Children>
    </>
  );
}

export function EventBusCard(props: CardProps<"EventBus">) {
  return (
    <>
      <Header resource={props.resource} />
      <Children>
        <For each={props.resource.metadata.rules}>
          {(rule) => (
            <For each={rule.targets}>
              {(target) => (
                <FunctionChild id={target?.node} tag="Subscription" />
              )}
            </For>
          )}
        </For>
      </Children>
    </>
  );
}

export function TopicCard(props: CardProps<"Topic">) {
  return (
    <>
      <Header resource={props.resource} />
      <Children>
        <For each={props.resource.metadata.subscribers}>
          {(sub) => <FunctionChild id={sub?.node} tag="Subscriber" />}
        </For>
      </Children>
    </>
  );
}
export function BucketCard(props: CardProps<"Bucket">) {
  return (
    <>
      <Header resource={props.resource} />
      {props.resource.metadata.notifications.length > 0 && (
        <Children>
          <For each={props.resource.metadata.notifications}>
            {(notification) => (
              <FunctionChild id={notification?.node} tag="Notification" />
            )}
          </For>
        </Children>
      )}
    </>
  );
}

export function KinesisStreamCard(props: CardProps<"KinesisStream">) {
  return (
    <>
      <Header resource={props.resource} />
      <Children>
        <For each={props.resource.metadata.consumers}>
          {(consumer) => (
            <FunctionChild id={consumer.fn?.node} tag="Consumer" />
          )}
        </For>
      </Children>
    </>
  );
}

export function AppSyncCard(props: CardProps<"AppSync">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl || props.resource.metadata.url
        }
      />
      <Children>
        <For each={props.resource.metadata.dataSources}>
          {(source) => <FunctionChild id={source.fn?.node} tag="Source" />}
        </For>
      </Children>
    </>
  );
}

export function TableCard(props: CardProps<"Table">) {
  return (
    <>
      <Header resource={props.resource} />
      <Children>
        <For each={props.resource.metadata.consumers}>
          {(consumer) => (
            <FunctionChild id={consumer.fn?.node} tag="Consumer" />
          )}
        </For>
      </Children>
    </>
  );
}

export function ScriptCard(props: CardProps<"Script">) {
  return (
    <>
      <Header resource={props.resource} />
      <Children>
        <FunctionChild
          id={props.resource.metadata.createfn?.node}
          tag="Create"
        />
        <FunctionChild
          id={props.resource.metadata.deletefn?.node}
          tag="Delete"
        />
        <FunctionChild
          id={props.resource.metadata.updatefn?.node}
          tag="Update"
        />
      </Children>
    </>
  );
}

export function CognitoCard(props: CardProps<"Cognito">) {
  return (
    <>
      <Header resource={props.resource} />
      <Children>
        <For each={props.resource.metadata.triggers}>
          {(trigger) => <FunctionChild id={trigger.fn?.node} tag="Trigger" />}
        </For>
      </Children>
    </>
  );
}

export function CronCard(props: CardProps<"Cron">) {
  return (
    <>
      <Header
        resource={props.resource}
        description={props.resource.metadata.schedule}
      />
      <Children>
        <FunctionChild id={props.resource.metadata.job?.node} tag="Job" />
      </Children>
    </>
  );
}

export function QueueCard(props: CardProps<"Queue">) {
  return (
    <>
      <Header resource={props.resource} />
      <Children>
        <FunctionChild
          id={props.resource.metadata.consumer?.node}
          tag="Consumer"
        />
      </Children>
    </>
  );
}

export function StaticSiteCard(props: CardProps<"StaticSite">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          cleanFilepath(props.resource.metadata.path)
        }
      />
    </>
  );
}

export function NextjsSiteCard(props: CardProps<"NextjsSite">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          cleanFilepath(props.resource.metadata.path)
        }
      />
      <Show when={props.resource.metadata.mode === "deployed"}>
        <Children>
          <For
            each={props.resource.metadata.routes?.data || []}
            fallback={
              <FunctionChild id={props.resource.metadata.server} tag="Server" />
            }
          >
            {(item) => {
              return (
                <FunctionChild
                  logGroup={
                    props.resource.metadata.routes?.logGroupPrefix +
                    item.logGroupPath
                  }
                  title={item.route}
                  tagSize="small"
                  id={props.resource.metadata.server}
                />
              );
            }}
          </For>
        </Children>
      </Show>
    </>
  );
}

export function SvelteKitSiteCard(props: CardProps<"SvelteKitSite">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          cleanFilepath(props.resource.metadata.path)
        }
      />
      <Show when={props.resource.metadata.mode === "deployed"}>
        <Children>
          <FunctionChild id={props.resource.metadata.server} tag="Server" />
        </Children>
      </Show>
    </>
  );
}

export function RemixSiteCard(props: CardProps<"RemixSite">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          cleanFilepath(props.resource.metadata.path)
        }
      />
      <Show when={props.resource.metadata.mode === "deployed"}>
        <Children>
          <FunctionChild id={props.resource.metadata.server} tag="Server" />
        </Children>
      </Show>
    </>
  );
}

export function AstroSiteCard(props: CardProps<"AstroSite">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          cleanFilepath(props.resource.metadata.path)
        }
      />
      <Show when={props.resource.metadata.mode === "deployed"}>
        <Children>
          <FunctionChild id={props.resource.metadata.server} tag="Server" />
        </Children>
      </Show>
    </>
  );
}

export function SolidStartSiteCard(props: CardProps<"SolidStartSite">) {
  return (
    <>
      <Header
        resource={props.resource}
        link={getUrl(
          props.resource.metadata.url,
          props.resource.metadata.customDomainUrl,
        )}
        description={
          props.resource.metadata.customDomainUrl ||
          props.resource.metadata.url ||
          cleanFilepath(props.resource.metadata.path)
        }
      />
      <Show when={props.resource.metadata.mode === "deployed"}>
        <Children>
          <FunctionChild id={props.resource.metadata.server} tag="Server" />
        </Children>
      </Show>
    </>
  );
}

export function RDSCard(props: CardProps<"RDS">) {
  return (
    <>
      <Header
        resource={props.resource}
        description={props.resource.metadata.defaultDatabaseName}
      />
      <Children>
        <FunctionChild
          tag="Migrator"
          id={props.resource.metadata.migrator?.node}
        />
      </Children>
    </>
  );
}

function FunctionChild(props: {
  id: string | undefined;
  tag?: string;
  title?: string;
  logGroup?: string;
  tagSize?: ComponentProps<typeof Tag>["size"];
}) {
  const resources = useResourcesContext();
  const fn = createMemo(() => getFunctionById(resources(), props.id!));
  const runtime = createMemo(
    () => fn()?.metadata.runtime || fn()?.enrichment.runtime || "",
  );
  return (
    <Show when={fn()}>
      {(exists) => (
        <Child>
          <Row space="3" vertical="center">
            <Show when={props.tag}>
              <Tag style="outline" size={props.tagSize}>
                {props.tag!}
              </Tag>
            </Show>
            <ChildTitleLink
              href={`./logs/${exists().id}?logGroup=${props.logGroup || ""}`}
            >
              <Show
                when={props.title}
                fallback={
                  exists().metadata.handler
                    ? new URL(
                        "https://example.com/" + exists().metadata.handler,
                      ).pathname.replace(/\/+/g, "/")
                    : exists().cfnID
                }
              >
                {formatPath(props.title)}
              </Show>
            </ChildTitleLink>
          </Row>
          <Row flex={false} space="3" vertical="center">
            <Show when={exists().enrichment.size}>
              {(value) => {
                const formattedSize = formatBytes(value());
                return (
                  <ChildDetail>
                    {formattedSize.value}
                    <ChildDetailUnit>{formattedSize.unit}</ChildDetailUnit>
                  </ChildDetail>
                );
              }}
            </Show>
            <ChildIcon title={runtime()}>
              <Switch>
                <Match when={runtime().startsWith("dotnet")}>
                  <IconDotNetRuntime />
                </Match>
                <Match when={runtime().startsWith("dotnet")}>
                  <IconDotNetRuntime />
                </Match>
                <Match when={runtime().startsWith("python")}>
                  <IconPythonRuntime />
                </Match>
                <Match when={runtime().startsWith("java")}>
                  <IconJavaRuntime />
                </Match>
                <Match when={runtime().startsWith("go")}>
                  <IconGoRuntime />
                </Match>
                <Match when={runtime().startsWith("nodejs")}>
                  <IconNodeRuntime />
                </Match>
                <Match when={runtime().startsWith("rust")}>
                  <IconRustRuntime />
                </Match>
                <Match when={runtime().startsWith("container")}>
                  <IconContainerRuntime />
                </Match>
                <Match when={true}>
                  <IconFunction />
                </Match>
              </Switch>
            </ChildIcon>
          </Row>
        </Child>
      )}
    </Show>
  );
}
