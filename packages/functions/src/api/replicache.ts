import { DateTime } from "luxon";
import { useActor, useWorkspace } from "@console/core/actor";
import { user } from "@console/core/user/user.sql";
import { createTransaction } from "@console/core/util/transaction";
import {
  eq,
  and,
  gt,
  gte,
  inArray,
  isNull,
  SQLWrapper,
  sql,
  SQL,
} from "drizzle-orm";
import { workspace } from "@console/core/workspace/workspace.sql";
import { stripe, usage } from "@console/core/billing/billing.sql";
import { app, appRepoTable, resource, stage } from "@console/core/app/app.sql";
import { awsAccount } from "@console/core/aws/aws.sql";
import {
  replicache_client,
  replicache_client_group,
} from "@console/core/replicache/replicache.sql";
import { lambdaPayload } from "@console/core/lambda/lambda.sql";
import { chunk, isDeepEqual, mapValues } from "remeda";
import { log_poller, log_search } from "@console/core/log/log.sql";
import {
  PatchOperation,
  PullRequest,
  PullResponseV1,
  PushRequest,
} from "replicache";
import { warning } from "@console/core/warning/warning.sql";
import { issue, issueCount } from "@console/core/issue/issue.sql";
import { MySqlColumn } from "drizzle-orm/mysql-core";
import {
  db,
  getTableColumns,
  isNotNull,
  notInArray,
} from "@console/core/drizzle";
import { githubOrgTable, githubRepoTable } from "@console/core/git/git.sql";
import { slackTeam } from "@console/core/slack/slack.sql";
import {
  stateEventTable,
  stateResourceTable,
  stateUpdateTable,
} from "@console/core/state/state.sql";
import { State } from "@console/core/state";
import { runConfigTable, runTable } from "@console/core/run/run.sql";
import { Run } from "@console/core/run";
import { Replicache } from "@console/core/replicache";
import { AppRepo } from "@console/core/app/repo";
import { Github } from "@console/core/git/github";
import { alert } from "@console/core/alert/alert.sql";
import { Alert } from "@console/core/alert";
import { S3Client } from "@aws-sdk/client-s3";
import { Hono } from "hono";
import { notPublic } from "./auth";
import { server } from "src/replicache/server";
import { VisibleError } from "@console/core/util/error";

export const ReplicacheRoute = new Hono().use(notPublic);

export const TABLES = {
  stateUpdate: stateUpdateTable,
  stateResource: stateResourceTable,
  stateEvent: stateEventTable,
  workspace,
  stripe,
  user,
  awsAccount,
  app,
  appRepo: appRepoTable,
  stage,
  resource,
  log_poller,
  log_search,
  lambdaPayload,
  warning,
  issue,
  issueCount,
  alert,
  githubOrg: githubOrgTable,
  githubRepo: githubRepoTable,
  slackTeam,
  usage,
  run: runTable,
  runConfig: runConfigTable,
};

type TableName = keyof typeof TABLES;

const TABLE_KEY = {
  appRepo: [appRepoTable.appID, appRepoTable.id],
  runConfig: [runConfigTable.appID, runConfigTable.id],
  issue: [issue.stageID, issue.id],
  resource: [resource.stageID, resource.id],
  issueCount: [issueCount.group, issueCount.id],
  warning: [warning.stageID, warning.type, warning.id],
  usage: [usage.stageID, usage.id],
  stateUpdate: [stateUpdateTable.stageID, stateUpdateTable.id],
  stateResource: [stateResourceTable.stageID, stateResourceTable.id],
  stateEvent: [
    stateEventTable.stageID,
    stateEventTable.updateID,
    stateEventTable.id,
  ],
  run: [runTable.stageID, runTable.id],
  stripe: [],
} as {
  [key in TableName]?: MySqlColumn[];
};

const TABLE_SELECT = {
  stateEvent: (() => {
    const { inputs, outputs, ...rest } = getTableColumns(stateEventTable);
    return rest;
  })(),
} as {
  [key in TableName]?: any;
};

const TABLE_PROJECTION = {
  alert: (input) => Alert.serialize(input),
  appRepo: (input) => AppRepo.serializeAppRepo(input),
  githubOrg: (input) => Github.serializeOrg(input),
  githubRepo: (input) => Github.serializeRepo(input),
  stateUpdate: (input) => State.serializeUpdate(input),
  stateEvent: (input) => State.serializeEvent(input),
  stateResource: (input) => State.serializeResource(input),
  runConfig: (input) => {
    if (!input.env) return input;
    for (const key of Object.keys(input.env)) {
      input.env[key] = "__secret";
    }
    return input;
  },
  run: (input) => Run.serializeRun(input),
} as {
  [key in TableName]?: (input: (typeof TABLES)[key]["$inferSelect"]) => any;
};

const s3 = new S3Client({});

ReplicacheRoute.post("/pull1", async (c) => {
  const actor = useActor();
  function log(...args: any[]) {
    if (process.env.SST_DEV) return;
    console.log(...args);
  }
  log("actor", actor);

  const req: PullRequest = await c.req.json<PullRequest>();
  log("request", req);
  if (req.pullVersion !== 1) {
    return c.redirect("/replicache/pull");
  }

  await db.insert(replicache_client_group).ignore().values({
    id: req.clientGroupID,
    cvrVersion: 0,
    actor,
    clientVersion: 0,
  });
  const resp = await createTransaction(
    async (tx): Promise<PullResponseV1 | undefined> => {
      const patch: PatchOperation[] = [];

      const group = await tx
        .select({
          id: replicache_client_group.id,
          cvrVersion: replicache_client_group.cvrVersion,
          clientVersion: replicache_client_group.clientVersion,
          actor: replicache_client_group.actor,
        })
        .from(replicache_client_group)
        .for("update")
        .where(and(eq(replicache_client_group.id, req.clientGroupID)))
        .execute()
        .then((rows) => rows.at(0)!);

      if (!isDeepEqual(group.actor, actor)) {
        log("compare failed", group.actor, actor);
        return;
      }

      const oldCvr = await Replicache.CVR.get(
        req.clientGroupID,
        req.cookie as number,
      );

      const cvr = oldCvr ?? {
        data: {},
        clientVersion: 0,
      };

      const toPut: Record<string, { id: string; key: string }[]> = {};
      const nextCvr = {
        data: {} as Record<string, number>,
        version: Math.max(req.cookie as number, group.cvrVersion) + 1,
      };

      if (!oldCvr) {
        patch.push({
          op: "clear",
        });
        patch.push({
          op: "put",
          key: "/init",
          value: true,
        });
      }

      const results: [
        string,
        { id: string; version: string; key: string }[],
      ][] = [];

      if (actor.type === "user") {
        log("syncing user");

        const deletedStages = await tx
          .select({ id: stage.id })
          .from(stage)
          .where(
            and(
              isNotNull(stage.timeDeleted),
              eq(stage.workspaceID, useWorkspace()),
            ),
          )
          .then((rows) => rows.map((row) => row.id));

        const updates = await tx
          .select({
            id: stateUpdateTable.id,
            rowNumber:
              sql<string>`ROW_NUMBER() OVER (PARTITION BY ${stateUpdateTable.stageID} ORDER BY ${stateUpdateTable.index} DESC)`.as(
                "row_number",
              ),
          })
          .from(stateUpdateTable)
          .where(
            and(
              eq(stateUpdateTable.workspaceID, useWorkspace()),
              deletedStages.length
                ? notInArray(stateUpdateTable.stageID, deletedStages)
                : undefined,
            ),
          )
          .then((rows) =>
            rows
              .filter((row) => parseInt(row.rowNumber) < 100)
              .map((row) => row.id),
          );

        const runs = await tx
          .select({
            id: runTable.id,
            rowNumber:
              sql<string>`ROW_NUMBER() OVER (PARTITION BY ${runTable.stageID} ORDER BY ${runTable.timeCompleted} DESC)`.as(
                "row_number",
              ),
          })
          .from(runTable)
          .where(
            and(
              eq(runTable.workspaceID, useWorkspace()),
              deletedStages.length
                ? notInArray(runTable.stageID, deletedStages)
                : undefined,
            ),
          )
          .then((rows) =>
            rows
              .filter((row) => parseInt(row.rowNumber) < 100)
              .map((row) => row.id),
          );
        const tableFilters = {
          log_search: eq(log_search.userID, actor.properties.userID),
          usage: gte(
            usage.day,
            DateTime.now().toUTC().startOf("month").toSQLDate()!,
          ),
          issueCount: gte(
            issueCount.hour,
            DateTime.now()
              .toUTC()
              .startOf("hour")
              .minus({ day: 1 })
              .toSQL({ includeOffset: false })!,
          ),
          issue: isNull(issue.timeDeleted),
          ...(updates.length
            ? {
                stateEvent: inArray(stateEventTable.updateID, updates),
                stateUpdate: inArray(stateUpdateTable.id, updates),
                stateResource: notInArray(stateResourceTable.updateID, updates),
              }
            : {}),
          run: runs.length ? inArray(runTable.id, runs) : undefined,
        } satisfies {
          [key in keyof typeof TABLES]?: SQLWrapper;
        };

        const workspaceID = useWorkspace();

        for (const [name, table] of Object.entries(TABLES)) {
          const key = TABLE_KEY[name as TableName] ?? [table.id];
          const query = tx
            .select({
              name: sql`${name}`,
              id: table.id,
              version: table.timeUpdated,
              key: sql.join([
                sql`concat_ws(`,
                sql.join([sql`'/'`, sql`''`, sql`${name}`, ...key], sql`, `),
                sql.raw(`)`),
              ]) as SQL<string>,
            })
            .from(table)
            .where(
              and(
                eq(
                  "workspaceID" in table ? table.workspaceID : table.id,
                  workspaceID,
                ),
                ...(name === "stage" ? [] : [isNull(table.timeDeleted)]),
                ...(name in tableFilters
                  ? [tableFilters[name as keyof typeof tableFilters]]
                  : []),
              ),
            );
          log("getting updated from", name);
          const rows = await query.execute();
          results.push([name, rows as any]);
        }
      }

      if (actor.type === "account") {
        log("syncing account");

        const [users] = await Promise.all([
          await tx
            .select({
              id: user.id,
              key: sql<string>`concat('/user/', ${user.id})`,
              version: user.timeUpdated,
            })
            .from(user)
            .innerJoin(workspace, eq(user.workspaceID, workspace.id))
            .where(
              and(
                eq(user.email, actor.properties.email),
                isNull(user.timeDeleted),
                isNull(workspace.timeDeleted),
              ),
            )
            .execute(),
        ]);
        results.push(["user", users]);

        const workspaces = await tx
          .select({
            id: workspace.id,
            version: workspace.timeUpdated,
            key: sql<string>`concat('/workspace/', ${workspace.id})`,
          })
          .from(workspace)
          .leftJoin(user, eq(user.workspaceID, workspace.id))
          .where(
            and(
              eq(user.email, actor.properties.email),
              isNull(user.timeDeleted),
              isNull(workspace.timeDeleted),
            ),
          )
          .execute();
        results.push(["workspace", workspaces]);
      }

      for (const [name, rows] of results) {
        const arr = [];
        for (const row of rows) {
          const version = new Date(row.version).getTime();
          if (cvr.data[row.key] !== version) {
            arr.push(row);
          }
          delete cvr.data[row.key];
          nextCvr.data[row.key] = version;
        }
        toPut[name] = arr;
      }

      log(
        "toPut",
        mapValues(toPut, (value) => value.length),
      );

      log("toDel", cvr.data);

      // new data
      for (const [name, items] of Object.entries(toPut)) {
        log(name);
        const ids = items.map((item) => item.id);
        const keys = Object.fromEntries(
          items.map((item) => [item.id, item.key]),
        );

        if (!ids.length) continue;
        const table = TABLES[name as keyof typeof TABLES];

        for (const group of chunk(ids, 200)) {
          const now = Date.now();
          log(name, "fetching", group.length);
          const rows = await tx
            .select(
              TABLE_SELECT[name as keyof typeof TABLE_SELECT] ||
                getTableColumns(table),
            )
            .from(table)
            .where(
              and(
                "workspaceID" in table && actor.type === "user"
                  ? eq(table.workspaceID, useWorkspace())
                  : undefined,
                inArray(table.id, group),
              ),
            )
            .execute();
          log(name, "got", rows.length, "in", Date.now() - now, "ms");
          const projection =
            TABLE_PROJECTION[name as keyof typeof TABLE_PROJECTION];
          for (const row of rows) {
            const key = keys[row.id]!;
            patch.push({
              op: "put",
              key,
              value: projection ? projection(row as any) : row,
            });
          }
        }
      }

      // remove deleted data
      for (const [key] of Object.entries(cvr.data)) {
        patch.push({
          op: "del",
          key,
        });
      }

      const clients = await tx
        .select({
          id: replicache_client.id,
          mutationID: replicache_client.mutationID,
          clientVersion: replicache_client.clientVersion,
        })
        .from(replicache_client)
        .where(
          and(
            eq(replicache_client.clientGroupID, req.clientGroupID),
            gt(replicache_client.clientVersion, cvr.clientVersion),
          ),
        )
        .execute();

      const lastMutationIDChanges = Object.fromEntries(
        clients.map((c) => [c.id, c.mutationID] as const),
      );
      if (patch.length > 0 || Object.keys(lastMutationIDChanges).length > 0) {
        log("inserting", req.clientGroupID);
        await tx
          .update(replicache_client_group)
          .set({
            cvrVersion: nextCvr.version,
          })
          .where(eq(replicache_client_group.id, req.clientGroupID))
          .execute();

        await Replicache.CVR.put(req.clientGroupID, nextCvr.version, {
          data: nextCvr.data,
          clientVersion: group.clientVersion,
        });

        return {
          patch,
          cookie: nextCvr.version,
          lastMutationIDChanges,
        };
      }

      return {
        patch: [],
        cookie: req.cookie,
        lastMutationIDChanges,
      };
    },
    {
      isolationLevel: "repeatable read",
    },
  );

  return c.json(resp);
});

ReplicacheRoute.post("/push1", async (c) => {
  const actor = useActor();

  const body = await c.req.json<PushRequest>();
  if (body.pushVersion !== 1) return c.redirect("/replicache/push");

  for (const mutation of body.mutations) {
    await createTransaction(
      async (tx) => {
        const group = await tx
          .select({
            id: replicache_client_group.id,
            cvrVersion: replicache_client_group.cvrVersion,
            clientVersion: replicache_client_group.clientVersion,
            actor: replicache_client_group.actor,
          })
          .from(replicache_client_group)
          .for("update")
          .where(and(eq(replicache_client_group.id, body.clientGroupID)))
          .execute()
          .then(
            (rows) =>
              rows.at(0) ?? {
                id: body.clientGroupID,
                actor: actor,
                cvrVersion: 0,
                clientVersion: 0,
              },
          );

        // if (!equals(group.actor, actor)) {
        //   throw new Error(
        //     `${actor} is not authorized to push to ${body.clientGroupID}}`
        //   );
        // }

        const client = await tx
          .select({
            id: replicache_client.id,
            clientGroupID: replicache_client.clientGroupID,
            mutationID: replicache_client.mutationID,
            clientVersion: replicache_client.clientVersion,
          })
          .from(replicache_client)
          .for("update")
          .where(and(eq(replicache_client.id, mutation.clientID)))
          .execute()
          .then(
            (rows) =>
              rows.at(0) || {
                id: body.clientGroupID,
                clientGroupID: body.clientGroupID,
                mutationID: 0,
                clientVersion: 0,
              },
          );

        const nextClientVersion = group.clientVersion + 1;
        const nextMutationID = client.mutationID + 1;

        if (mutation.id < nextMutationID) {
          console.log(
            `Mutation ${mutation.id} has already been processed - skipping`,
          );
          return c.status(200);
        }

        if (mutation.id > nextMutationID) {
          throw new Error(
            `Mutation ${mutation.id} is from the future - aborting`,
          );
        }

        const { args, name } = mutation;
        console.log("processing", mutation.id, name);
        try {
          await server.execute(name, args);
        } catch (ex) {
          if (!(ex instanceof VisibleError)) console.error(ex);
        }
        console.log("done processing", mutation.id, name);

        await tx
          .insert(replicache_client_group)
          .values({
            id: body.clientGroupID,
            clientVersion: nextClientVersion,
            cvrVersion: group.cvrVersion,
            actor,
          })
          .onDuplicateKeyUpdate({
            set: {
              cvrVersion: group.cvrVersion,
              clientVersion: nextClientVersion,
            },
          })
          .execute();

        await tx
          .insert(replicache_client)
          .values({
            id: mutation.clientID,
            clientGroupID: group.id,
            mutationID: nextMutationID,
            clientVersion: nextClientVersion,
          })
          .onDuplicateKeyUpdate({
            set: {
              clientGroupID: group.id,
              mutationID: nextMutationID,
              clientVersion: nextClientVersion,
            },
          })
          .execute();
      },
      {
        isolationLevel: "repeatable read",
      },
    );
  }

  if (actor.type === "user") await Replicache.poke();

  return c.text("ok");
});
