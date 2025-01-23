import { Resource } from "sst";
import { PlanetScaleVStream, TableCursor } from "planetscale-stream-ts";
import { postgres, sql } from "@console/core/drizzle/index";
import { workspaceTable } from "@console/core/workspace/workspace.pg";

const vstream = new PlanetScaleVStream({
  db_config: {
    host: "aws.connect.psdb.cloud",
    database: Resource.Database.database,
    username: Resource.Database.username,
    password: Resource.Database.password,
    use_replica: false,
  },
  table_name: "workspace",
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
    console.log("update", update.after);
    if (!update.after) continue;
    const data = {
      id: update.after.id,
      slug: update.after.slug,
      settingIssue: update.after.settingIssue || true,
      timeGated: update.after.timeGated,
      timeCreated: update.after.timeCreated,
      timeDeleted: update.after.timeDeleted,
    };
    await postgres.insert(workspaceTable).values(data).onConflictDoUpdate({
      target: workspaceTable.id,
      set: data,
    });
  }
}
