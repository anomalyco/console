import { provideActor } from "@console/core/actor";
import { AWS } from "@console/core/aws/index";
import { awsAccount } from "@console/core/aws/aws.sql";
import { db } from "@console/core/drizzle/index";

const rows = await db.select().from(awsAccount).execute();
for (const row of rows) {
  provideActor({
    type: "system",
    properties: {
      workspaceID: row.workspaceID,
    },
  });
  await AWS.Account.Events.Created.publish({
    awsAccountID: row.id,
  });
}
