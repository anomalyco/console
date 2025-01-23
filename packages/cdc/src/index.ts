import { Resource } from "sst";
import { PlanetScaleVStream, TableCursor } from "planetscale-stream-ts";
import { postgres, sql } from "@console/core/drizzle/index";
import { workspaceTable } from "@console/core/workspace/workspace.pg";
import { PgTableWithColumns } from "drizzle-orm/pg-core";

async function sync<Table extends PgTableWithColumns<any>>(
  table: Table,
  transform: (input: any) => Table["$inferInsert"],
) {
  console.log("syncing", table._.name);
  const vstream = new PlanetScaleVStream({
    db_config: {
      host: "aws.connect.psdb.cloud",
      database: Resource.Database.database,
      username: Resource.Database.username,
      password: Resource.Database.password,
      use_replica: false,
    },
    table_name: table._.name,
  });

  const stream = vstream.stream({
    starting_cursor: new TableCursor({
      keyspace: "sst",
      shard: "-",
      position: "current",
    }),
  });

  for await (const item of stream) {
    if (!item.inserts.length && !item.updates.length && !item.deletes.length)
      continue;
    for (const update of item.updates) {
      if (!update.after) continue;
      const data = {
        slug: update.after.slug,
        settingIssue: update.after.setting_issue === 1,
        timeGated: update.after.time_gated,
        timeCreated: update.after.time_created,
        timeDeleted: update.after.time_deleted,
      };
      console.log("inserting", data);
      await postgres
        .insert(workspaceTable)
        .values({
          id: update.after.id,
          ...data,
        })
        .onConflictDoUpdate({
          target: [workspaceTable.id],
          set: data,
        })
        .then(console.log);
    }
  }
}

await sync(workspaceTable, (input) => {
  return {
    slug: input.slug,
    settingIssue: input.setting_issue === 1,
    timeGated: input.time_gated,
    timeCreated: input.time_created,
    timeDeleted: input.time_deleted,
  };
});
