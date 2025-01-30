import type { Error } from "@console/core/state/state.sql";
import {
  createSchema,
  definePermissions,
  table,
  string,
  number,
  relationships,
  json,
} from "@rocicorp/zero";

const timestamps = {
  time_created: number(),
  time_deleted: number().optional(),
} as const;

const workspace = table("workspace")
  .columns({
    id: string(),
    slug: string(),
    ...timestamps,
  })
  .primaryKey("id");

const user = table("user")
  .columns({
    id: string(),
    workspace_id: string(),
    email: string(),
    time_created: number(),
    time_deleted: number().optional(),
    time_seen: number().optional(),
  })
  .primaryKey("workspace_id", "id");

const state_update = table("state_update")
  .columns({
    id: string(),
    workspace_id: string(),
    stage_id: string(),
    run_id: string(),
    command: string(),
    index: number(),
    time_started: number(),
    time_completed: number(),
    resource_deleted: number(),
    resource_created: number(),
    resource_updated: number(),
    resource_same: number(),
    errors: json<Error[]>(),
    ...timestamps,
  })
  .primaryKey("workspace_id", "id");

const state_event = table("state_event")
  .columns({
    id: string(),
    workspace_id: string(),
    stage_id: string(),
    update_id: string(),
    type: string(),
    sequence: number(),
    timestamp: number(),
    data: json<any>(),
    ...timestamps,
  })
  .primaryKey("workspace_id", "id");

export const schema = createSchema(1, {
  tables: [workspace, state_update, user, state_event],
  relationships: [
    relationships(state_update, (r) => ({
      workspace: r.one({
        sourceField: ["workspace_id"],
        destSchema: workspace,
        destField: ["id"],
      }),
    })),
    relationships(user, (r) => ({
      workspace: r.one({
        sourceField: ["workspace_id"],
        destSchema: workspace,
        destField: ["id"],
      }),
    })),
    relationships(state_event, (r) => ({
      workspace: r.one({
        sourceField: ["workspace_id"],
        destSchema: workspace,
        destField: ["id"],
      }),
      users: r.many({
        sourceField: ["workspace_id"],
        destSchema: user,
        destField: ["workspace_id"],
      }),
      stage: r.one({
        sourceField: ["stage_id"],
        destSchema: workspace,
        destField: ["id"],
      }),
      update: r.one({
        sourceField: ["update_id"],
        destSchema: state_update,
        destField: ["id"],
      }),
    })),
    relationships(workspace, (r) => ({
      users: r.many({
        sourceField: ["id"],
        destSchema: user,
        destField: ["workspace_id"],
      }),
    })),
  ],
});

export type Schema = typeof schema;

type Auth = {
  sub: string;
  properties: {
    accountID: string;
    email: string;
  };
};

export const permissions = definePermissions<Auth, Schema>(schema, () => {
  const readonly = {
    row: {
      select: [
        (auth: Auth, q: any) =>
          q.exists("workspace", (w: any) =>
            w.whereExists("users", (u: any) => u.where("email", auth.sub)),
          ),
      ],
    },
  };
  return {
    state_event: {
      row: {
        select: [
          (auth, q) => q.exists("users", (u) => u.where("email", auth.sub)),
        ],
      },
    },
    state_update: {},
    user: {},
    workspace: {},
  };
});
