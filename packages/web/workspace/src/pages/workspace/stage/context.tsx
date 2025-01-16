import { useReplicache } from "$/providers/replicache";
import { createContext, createMemo, useContext } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { StageStore } from "$/data/stage";
import { AppStore, StateResourceStore } from "$/data/app";
import { NavigationAction, useCommandBar } from "../command-bar";
import { useLocalContext } from "$/providers/local";
import { createInitializedContext } from "$/common/context";
import { IssueStore } from "$/data/issue";
import { flatMap, groupBy, map, mapValues, pipe, sortBy, values } from "remeda";
import { useWorkspace } from "../context";

export const StageContext =
  createContext<ReturnType<typeof createStageContext>>();

export function createStageContext() {
  const params = useParams();
  const rep = useReplicache();
  const app = AppStore.all.watch(
    rep,
    () => [],
    (items) => items.find((app) => app.name === params.appName)
  );
  const stage = StageStore.list.watch(
    rep,
    () => [],
    (items) =>
      items.find(
        (stage) =>
          stage.appID === app()?.id &&
          !stage.timeDeleted &&
          (stage.name === params.stageName || stage.id === params.stageName)
      )
  );
  const local = useLocalContext();

  return {
    get ready() {
      return app.ready && stage.ready;
    },
    get app() {
      return app()!;
    },
    get stage() {
      return stage()!;
    },
    get connected() {
      return (
        local.app === app.name &&
        local.stage === stage.name &&
        (!local.region || stage()?.region === local.region)
      );
    },
  };
}

export function useStageContext() {
  const context = useContext(StageContext);
  if (!context) throw new Error("No stage context");
  return context;
}

export const { use: useIssuesContext, provider: IssuesProvider } =
  createInitializedContext("Issues", () => {
    const rep = useReplicache();
    const ctx = useStageContext();
    const issues = IssueStore.forStage.watch(rep, () => [ctx.stage.id]);
    return issues;
  });

export const { use: useStateResources, provider: StateResourcesProvider } =
  createInitializedContext("Issues", () => {
    const rep = useReplicache();
    const ctx = useStageContext();
    const bar = useCommandBar();
    const nav = useNavigate();
    const resources = StateResourceStore.forStage.watch(rep, () => [
      ctx.stage.id,
    ]);
    bar.register("state-resources-switcher", async (input, global) => {
      if (!input) return [];

      return resources().map((resource) =>
        NavigationAction({
          nav,
          path: `resources/${encodeURIComponent(resource.urn)}`,
          title: resource.urn.split("::").at(-1)! + " (" + resource.type + ")",
          category: "resource",
        })
      );
    });
    return resources;
  });

export const { use: useLogsContext, provider: LogsProvider } =
  createInitializedContext("Logs", () => {
    const resources = useStateResources();
    const nav = useNavigate();
    const workspace = useWorkspace();
    const stage = useStageContext();
    const logs = createMemo(() =>
      pipe(
        resources(),
        flatMap((r) => {
          const name = r.urn.split("::").at(-1)!;
          if (r.type === "aws:cloudwatch/logGroup:LogGroup")
            return [
              {
                name,
                title: r.outputs?.id,
                link: `logGroup=${r.outputs?.id}&view=past&hint=normal`,
                type: r.type,
                logGroup: r.outputs?.id,
                priority: 1,
                icon: "construct",
              },
            ];

          if (r.type === "aws:lambda/function:Function") {
            const logGroup = r.outputs?.loggingConfig?.logGroup;
            return [
              {
                name,
                title: name,
                link: `functionID=${r.urn}&view=past&hint=lambda`,
                type: r.type,
                logGroup,
                priority: 2,
                icon: "function",
              },
            ];
          }
          if (r.type === "sst:aws:Function") {
            const lambda = resources().find(
              (child) =>
                child.type === "aws:lambda/function:Function" &&
                child.parent === r.urn
            );
            const logGroup = lambda?.outputs?.loggingConfig?.logGroup;
            const dev = lambda?.outputs?.description?.includes("live");
            return [
              {
                name,
                title: r.outputs?._metadata.handler,
                link: dev
                  ? `functionID=${r.urn}&view=local&hint=lambda`
                  : `logGroup=${logGroup}&view=past&hint=lambda`,
                type: r.type,
                logGroup,
                priority: 3,
                icon: "function",
              },
            ];
          }
          if (r.type === "sstv2:aws:Function") {
            console.log(r);
            const logGroup = r.outputs?.enrichment?.logGroup;
            const live = r.outputs?.enrichment?.live;
            return [
              {
                name,
                title: r.outputs?.handler,
                link: live
                  ? `functionID=${r.urn}&view=local&hint=lambda`
                  : `logGroup=${logGroup}&view=past&hint=lambda`,
                type: r.type,
                logGroup,
                priority: 3,
                icon: "function",
              },
            ];
          }
          if (r.type === "sst:aws:Service" || r.type === "sst:aws:Task") {
            const logGroup = resources().find(
              (child) =>
                child.type === "aws:cloudwatch/logGroup:LogGroup" &&
                child.parent === r.urn
            )?.outputs?.id;

            return [
              {
                name,
                title: name,
                link: `logGroup=${logGroup}&view=past&hint=normal`,
                type: r.type,
                logGroup: logGroup,
                priority: 3,
                icon: "container",
              },
            ];
          }
          return [];
        }),
        groupBy((item) => item.logGroup),
        mapValues((items) => sortBy(items, (item) => item.priority).at(-1)!),
        values(),
        sortBy((item) => item.title),
        map((item) => ({
          ...item,
          link:
            `/${workspace().slug}/${stage.app.name}/${
              stage.stage.name
            }/logs/aws?` + item.link,
        }))
      )
    );

    const bar = useCommandBar();
    bar.register("logs-switcher", async (input, global) => {
      if (!input && global) return [];
      return logs().map((item) =>
        NavigationAction({
          nav,
          path: item.link,
          title: item.title,
          category: "logs",
        })
      );
    });

    const result = () => logs();
    result.ready = true;
    return result;
  });
