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
import { useStageContext, useStateResources } from "../context";
import { styled } from "@macaron-css/solid";
import { style } from "@macaron-css/core";
import { utility } from "../../../../ui/utility";
import { Dropdown } from "../../../../ui/dropdown";
import { Fullscreen, Row, Stack } from "../../../../ui/layout";
import {
  IconApi,
  IconRDS,
  IconJob,
  IconAuth,
  IconCron,
  IconStack,
  IconTable,
  IconTopic,
  IconQueue,
  IconScript,
  IconBucket,
  IconConfig,
  IconConnect,
  IconAppSync,
  IconCognito,
  IconEventBus,
  IconFunction,
  IconConstruct,
  IconRemixSite,
  IconAstroSite,
  IconNextjsSite,
  IconStaticSite,
  IconWebSocketApi,
  IconSvelteKitSite,
  IconKinesisStream,
  IconSolidStartSite,
  IconApiGatewayV1Api,
  IconContainerRuntime,
} from "../../../../ui/icons/custom";
import { Resource } from "@console/core/app/resource";
import type { State } from "@console/core/state/index";
import { A } from "@solidjs/router";
import { Syncing } from "../../../../ui/loader";
import {
  IconCheck,
  IconEnvelope,
  IconEllipsisVertical,
  IconDocumentDuplicate,
} from "../../../../ui/icons";
import { PageStatusIcon } from "../updates/detail";
import { sortBy } from "remeda";
import { Dynamic } from "solid-js/web";
import { } from "@solid-primitives/keyboard";
import { formatSinceTime } from "../../../../common/format";
import { ResourceIcon } from "../../../../common/resource-icon";
import { createSubscription } from "../../../../providers/replicache";
import { StateUpdateStore } from "../../../../data/app";
import { DateTime } from "luxon";
import { ChevronLink } from "../../../../ui/button";
import { Text } from "../../../../ui/text";
import { theme } from "../../../../ui/theme";

const ION_ICON_MAP: { [key: string]: Component } = {
  "sst:aws:Cdn": IconApi,
  "sst:aws:Efs": IconRDS,
  "sst:aws:Redis": IconRDS,
  "sst:aws:Auth": IconAuth,
  "sst:aws:Cron": IconCron,
  "sst:aws:Router": IconApi,
  // "sst:aws:Job": IconJob,
  "sst:aws:Email": IconEnvelope,

  "sst:aws:Queue": IconQueue,
  "sst:aws:QueueLambdaSubscriber": IconFunction,

  "sst:aws:Vector": IconRDS,
  "sst:aws:Postgres": IconRDS,
  "sst:aws:Postgres.v1": IconRDS,

  "sst:aws:Dynamo": IconTable,
  "sst:aws:DynamoLambdaSubscriber": IconFunction,

  "sst:aws:Bus": IconEventBus,
  "sst:aws:BusLambdaSubscriber": IconFunction,

  "sst:aws:Bucket": IconBucket,
  "sst:aws:BucketLambdaSubscriber": IconFunction,

  "sst:aws:SnsTopic": IconTopic,
  "sst:aws:SnsTopicQueueSubscriber": IconQueue,
  "sst:aws:SnsTopicLambdaSubscriber": IconFunction,

  "sst:aws:Astro": IconAstroSite,
  "sst:aws:Nuxt": IconStaticSite,
  "sst:aws:Remix": IconRemixSite,
  "sst:aws:Analog": IconStaticSite,

  "sst:aws:AppSync": IconAppSync,
  "sst:aws:AppSyncResolver": IconAppSync,
  "sst:aws:AppSyncFunction": IconFunction,
  "sst:aws:AppSyncDataSource": IconAppSync,

  "sst:aws:ApiGatewayV2": IconApi,
  "sst:aws:ApiGatewayV2UrlRoute": IconApi,
  "sst:aws:ApiGatewayV2Authorizer": IconApi,
  "sst:aws:ApiGatewayV2LambdaRoute": IconApi,

  "sst:aws:ApiGatewayV1": IconApiGatewayV1Api,
  "sst:aws:ApiGatewayV1Authorizer": IconApiGatewayV1Api,
  "sst:aws:ApiGatewayV1LambdaRoute": IconApiGatewayV1Api,
  "sst:aws:ApiGatewayV1IntegrationRoute": IconApiGatewayV1Api,

  // "sst:aws:Script": IconScript,
  "sst:sst:Secret": IconConfig,
  "sst:sst:LinkRef": IconConnect,
  "sst:aws:Function": IconFunction,
  "sst:aws:Nextjs": IconNextjsSite,
  "sst:aws:Task": IconContainerRuntime,
  "sst:aws:Service": IconContainerRuntime,
  "sst:aws:Cluster": IconContainerRuntime,
  "sst:aws:Cluster.v1": IconContainerRuntime,

  "sst:aws:Realtime": IconWebSocketApi,
  "sst:aws:RealtimeLambdaSubscriber": IconFunction,

  "sst:aws:StaticSite": IconStaticSite,
  "sst:aws:SvelteKit": IconSvelteKitSite,
  "sst:aws:CognitoUserPool": IconCognito,
  "sst:aws:SolidStart": IconSolidStartSite,
  "sst:aws:CognitoIdentityPool": IconCognito,
  "sst:aws:CognitoUserPoolClient": IconCognito,

  "sst:aws:KinesisStream": IconKinesisStream,
  "sst:aws:KinesisStreamLambdaSubscriber": IconFunction,

  "sst:aws:ApiGatewayWebSocket": IconWebSocketApi,
  "pulumi:pulumi:Stack": IconStack,

  // V2 Resources
  "sstv2:aws:Job": IconJob,
  "sstv2:aws:Api": IconApi,
  "sstv2:aws:RDS": IconRDS,
  "sstv2:aws:Auth": IconAuth,
  "sstv2:aws:Cron": IconCron,
  "sstv2:aws:Queue": IconQueue,
  "sstv2:aws:Table": IconTable,
  "sstv2:aws:Topic": IconTopic,
  "sstv2:aws:Stack": IconStack,
  "sstv2:aws:Bucket": IconBucket,
  "sstv2:aws:Config": IconConfig,
  "sstv2:aws:Secret": IconConfig,
  "sstv2:aws:Script": IconScript,
  "sstv2:aws:Cognito": IconCognito,
  "sstv2:aws:EventBus": IconEventBus,
  "sstv2:aws:Function": IconFunction,
  "sstv2:aws:AppSyncApi": IconAppSync,
  "sstv2:aws:AstroSite": IconAstroSite,
  "sstv2:aws:RemixSite": IconRemixSite,
  "sstv2:aws:NextjsSite": IconNextjsSite,
  "sstv2:aws:StaticSite": IconStaticSite,
  "sstv2:aws:Service": IconContainerRuntime,
  "sstv2:aws:WebSocketApi": IconWebSocketApi,
  "sstv2:aws:KinesisStream": IconKinesisStream,
  "sstv2:aws:SvelteKitSite": IconSvelteKitSite,
  "sstv2:aws:SolidStartSite": IconSolidStartSite,
  "sstv2:aws:ApiGatewayV1Api": IconApiGatewayV1Api,
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

const TitleDescLink = styled(A, {
  base: {
    marginLeft: `calc(${theme.space[3]} + 12px)`,
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
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

const BlockLink = styled(A, {
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});

const HeaderRoot = styled("div", {
  base: {
    display: "flex",
    position: "relative",
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

const HeaderTitleTaglineLink = styled(A, {
  base: {
    ...utility.text.line,
    zIndex: 2,
    minWidth: 0,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    lineHeight: "normal",
    color: theme.color.text.secondary.base,
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
    zIndex: 2,
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


export const Child = styled("div", {
  base: {
    padding: `${theme.space[4]} 0`,
    position: "relative",
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

export const ChildTitleLink = styled(A, {
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

const ChildKeyLink = styled(A, {
  base: {
    ...utility.text.line,
    zIndex: 2,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.primary.base,
    lineHeight: "normal",
    minWidth: "33%",
  },
});

const childDropdown = style({
  zIndex: 2,
});

function isValidHttpUrl(string: string): boolean {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

function stateResourcePriority(resource: SortedStateResource) {
  switch (resource.type) {
    case "sst:aws:Nuxt":
    case "sst:aws:Remix":
    case "sst:aws:Astro":
    case "sst:aws:Nextjs":
    case "sst:aws:Analog":
    case "sst:aws:SvelteKit":
    case "sst:aws:SolidStart":
    case "sstv2:aws:RemixSite":
    case "sstv2:aws:AstroSite":
    case "sstv2:aws:NextjsSite":
    case "sstv2:aws:SvelteKitSite":
    case "sstv2:aws:SolidStartSite":
      return 1;
    case "sst:aws:StaticSite":
    case "sstv2:aws:StaticSite":
      return 2;
    case "sst:aws:Auth":
    case "sstv2:aws:Api":
    case "sstv2:aws:Auth":
    case "sst:aws:Router":
    case "sst:aws:Realtime":
    case "sst:aws:Cluster":
    case "sstv2:aws:Service":
    case "sst:aws:Cluster.v1":
    case "sst:aws:ApiGatewayV2":
      return 3;
    case "sst:aws:Function":
    case "sstv2:aws:Function":
    case "sst:aws:Service":
    case "sst:aws:Task":
      return 4;
    case "sst:sst:Secret":
    case "sstv2:aws:Config":
    case "sstv2:aws:Secret":
    case "sst:aws:Bucket":
    case "sstv2:aws:Bucket":
      return 5;
    case "sstv2:aws:RDS":
    case "sst:aws:Dynamo":
    case "sstv2:aws:Table":
    case "sst:aws:Postgres":
    case "sst:aws:Postgres.v1":
      return 6;
    case "sst:aws:Cron":
    case "sstv2:aws:Cron":
      return 7;
    case "sst:aws:Bus":
    case "sst:aws:Email":
    case "sstv2:aws:EventBus":
      return 8;
    case "sst:aws:Queue":
    case "sstv2:aws:Queue":
    case "sstv2:aws:Topic":
    case "sst:aws:SnsTopic":
    case "sst:aws:KinesisStream":
    case "sstv2:aws:KinesisStream":
      return 9;
    case "sst:aws:AppSync":
    case "sstv2:aws:AppSyncApi":
    case "sstv2:aws:WebSocketApi":
    case "sst:aws:ApiGatewayWebSocket":
      return 10;
    case "sstv2:aws:Cognito":
    case "sst:aws:CognitoUserPool":
    case "sst:aws:CognitoIdentityPool":
      return 11;
    case "sst:sst:LinkRef":
      return 102;
    case "pulumi:pulumi:Stack":
      return 103;
    default:
      if (resource.type.startsWith("pulumi:providers:")) {
        return 104;
      } else {
        return 101;
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
  const latestUpdate = createSubscription(() => async (tx) => {
    const updates = await StateUpdateStore.forStage(tx, ctx.stage.id);
    const latest = updates.sort((a, b) => b.index - a.index)[0];
    return latest;
  });

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

  function renderStateOutputs() {
    return (
      <Show when={stateOutputs().length}>
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
          <BlockLink href={encodeURIComponent(resource.urn)}></BlockLink>
          <Row space="2" vertical="center">
            <HeaderIcon outline>
              <Show
                fallback={<IconConstruct />}
                when={ION_ICON_MAP.hasOwnProperty(resource.type)}
              >
                <Dynamic component={ION_ICON_MAP[resource.type]} />
              </Show>
            </HeaderIcon>
            <HeaderTitle>{formatResourceType(resource.type)}</HeaderTitle>
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
                  <BlockLink href={encodeURIComponent(child.urn)}></BlockLink>
                  <ChildKeyLink href={encodeURIComponent(child.urn)}>
                    {child.name}
                  </ChildKeyLink>
                  <Row space="3" vertical="center">
                    <ChildValue outline>{child.type}</ChildValue>
                    <Dropdown
                      size="sm"
                      disabled={copying()}
                      triggerClass={childDropdown}
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
      <Match when={!stateResources().length}>
        <Fullscreen inset="header-tabs">
          <Syncing>Waiting for resources&hellip;</Syncing>
        </Fullscreen>
      </Match>
      <Match when={true}>
        <Content>
          <Stack space="6">
            <Show when={latestUpdate.value}>
              <TitleRoot>
                <Stack space="2.5">
                  <TitleRow>
                    <Switch>
                      <Match when={!latestUpdate.value!.time.completed}>
                        <PageStatusIcon status="updating" />
                      </Match>
                      <Match
                        when={
                          latestUpdate.value?.time.completed &&
                          latestUpdate.value?.errors.length === 0
                        }
                      >
                        <PageStatusIcon status="updated" />
                      </Match>
                      <Match when={latestUpdate.value?.errors.length}>
                        <PageStatusIcon status="error" />
                      </Match>
                    </Switch>
                    <TitleText>{ctx.stage.name}</TitleText>
                  </TitleRow>
                  <TitleDescLink href={`../updates/${latestUpdate.value!.id}`}>
                    Updated{" "}
                    {formatSinceTime(
                      DateTime.fromISO(
                        latestUpdate.value!.time.updated,
                      ).toSQL()!,
                      true,
                    )}
                  </TitleDescLink>
                </Stack>
                <ChevronLink href="../updates" size="sm">
                  View history
                </ChevronLink>
              </TitleRoot>
            </Show>
            <Stack space="5">
              {renderStateOutputs()}
              <For each={SortedStateResource()}>{renderStateResource}</For>
            </Stack>
          </Stack>
        </Content>
      </Match>
    </Switch>
  );
}

function formatResourceType(type: string) {
  return type.startsWith("sstv2") ? type.replace(/^sstv2:aws:/, "") : type;
}
