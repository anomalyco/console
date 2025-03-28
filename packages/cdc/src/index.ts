import { IndexColumn, PgTableWithColumns } from "drizzle-orm/pg-core";
import { appTable } from "@console/core/app/app.pg";
import { userTable } from "@console/core/user/user.pg";
import { workspaceTable } from "@console/core/workspace/workspace.pg";
import {
  stateCountTable,
  stateResourceTable,
  stateUpdateTable,
} from "@console/core/state/state.pg";
import { getTableColumns, sql } from "drizzle-orm";
import { postgres } from "@console/core/drizzle/postgres";

function transform<Table extends PgTableWithColumns<any>>(
  table: Table,
  pk: IndexColumn[],
  transform: (input: any) => Table["$inferInsert"],
) {
  return async (item: any) => {
    const row = transform(item);
    const columns = getTableColumns(table);
    const setObject = Object.keys(row).reduce(
      (acc, key) => {
        const col = columns[key];
        acc[col.name] = sql.raw(`excluded."${col.name}"`);
        return acc;
      },
      {} as Record<string, any>,
    );
    await postgres.insert(table).values(row).onConflictDoUpdate({
      target: pk,
      set: setObject,
    });
  };
}

type Message = {
  payload: {
    before: Record<string, any>;
    after: Record<string, any>;
    op: "u";
    source: {
      version: string;
      connector: string;
      name: string;
      ts_ms: number;
      snapshot: string;
      db: string;
      sequence: string | null;
      keyspace: string;
      table: string;
      shard: string;
      vgtid: string;
    };
  };
};

const transforms = {
  app: transform(appTable, [appTable.workspaceID, appTable.id], (input) => {
    return {
      id: input.id,
      workspaceID: input.workspace_id,
      timeCreated: new Date(input.time_created),
      timeDeleted: input.time_deleted
        ? new Date(input.time_deleted)
        : undefined,
      name: input.name,
    };
  }),
  user: transform(
    userTable,
    [userTable.workspaceID, userTable.id],
    (input) => ({
      id: input.id,
      workspaceID: input.workspace_id,
      timeCreated: new Date(input.time_created),
      timeDeleted: input.time_deleted
        ? new Date(input.time_deleted)
        : undefined,
      email: input.email,
      timeSeen: input.time_seen ? new Date(input.time_seen) : undefined,
    }),
  ),
  workspace: transform(workspaceTable, [workspaceTable.id], (input) => ({
    id: input.id,
    slug: input.slug,
    timeGated: input.timeGated ? new Date(input.timeGated) : undefined,
    timeCreated: new Date(input.timeCreated),
    timeDeleted: input.timeDeleted ? new Date(input.timeDeleted) : undefined,
    settingIssue: input.settingIssue,
  })),
  state_update: transform(
    stateUpdateTable,
    [stateUpdateTable.workspaceID, stateUpdateTable.id],
    (input) => {
      return {
        id: input.id,
        workspaceID: input.workspace_id,
        stageID: input.stage_id,
        version: input.version,
        runID: input.run_id,
        command: input.command,
        index: input.index,
        timeStarted: new Date(input.time_started),
        timeCompleted: new Date(input.time_completed),
        resourceDeleted: input.resource_deleted,
        resourceCreated: input.resource_created,
        resourceUpdated: input.resource_updated,
        resourceSame: input.resource_same,
        errors: input.errors,
        timeCreated: new Date(input.time_created),
        timeDeleted: input.time_deleted
          ? new Date(input.time_deleted)
          : undefined,
      };
    },
  ),
  state_resource: transform(
    stateResourceTable,
    [stateResourceTable.workspaceID, stateResourceTable.id],
    (input) => {
      return {
        id: input.id,
        workspaceID: input.workspace_id,
        stageID: input.stage_id,
        updateID: input.update_id,
        timeCreated: new Date(input.time_created),
        timeDeleted: input.time_deleted
          ? new Date(input.time_deleted)
          : undefined,
        urn: input.urn,
        type: input.type,
        outputs: input.outputs,
        inputs: input.inputs,
        parent: input.parent,
        custom: input.custom,
        timeStateCreated: new Date(input.time_state_created),
        timeStateModified: new Date(input.time_state_modified),
      };
    },
  ),
  state_count: transform(
    stateCountTable,
    [stateCountTable.workspaceID, stateCountTable.stageID],
    (input) => {
      console.log(input);
      return {
        id: input.id,
        workspaceID: input.workspace_id,
        stageID: input.stage_id,
        month: input.month,
        count: input.count,
        timeCreated: new Date(input.time_created),
        timeDeleted: input.time_deleted
          ? new Date(input.time_deleted)
          : undefined,
      };
    },
  ),
};

const server = Bun.serve({
  port: 3003,
  async fetch(request) {
    try {
      const msg = (await request.json()) as Message;
      console.log(msg.payload.source.table);
      // @ts-expect-error
      const transform = transforms[msg.payload.source.table];
      if (!transform) return new Response("skip");
      await transform(msg.payload.after);
    } catch (e) {
      console.error(e);
    }
    return new Response("ok");
  },
});

console.log("listening on port", server.port);
