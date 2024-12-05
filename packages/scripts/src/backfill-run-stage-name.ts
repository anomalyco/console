import { and, db, eq, isNotNull, isNull } from "@console/core/drizzle";
import { workspace } from "@console/core/workspace/workspace.sql";
import { runTable } from "@console/core/run/run.sql";
import { stage } from "@console/core/app/app.sql";
import { awsAccount } from "@console/core/aws/aws.sql";

const SIZE = 100000;
const runs = await db
  .select({
    workspaceID: stage.workspaceID,
    id: runTable.id,
    stageID: runTable.stageID,
    stageName: stage.name,
    region: stage.region,
    awsAccountExternalID: awsAccount.accountID,
  })
  .from(runTable)
  .innerJoin(stage, eq(runTable.stageID, stage.id))
  .innerJoin(awsAccount, eq(stage.awsAccountID, awsAccount.id))
  .where(and(isNotNull(runTable.stageID), isNull(runTable.stageName)))
  .limit(SIZE)
  .execute();

console.log("found", runs.length, "runs");

const processedStageIDs = new Set<string>();
for (const run of runs) {
  if (processedStageIDs.has(run.stageID!)) continue;
  processedStageIDs.add(run.stageID!);
  await db
    .update(runTable)
    .set({
      stageName: run.stageName,
      region: run.region,
      awsAccountExternalID: run.awsAccountExternalID,
    })
    .where(
      and(
        eq(runTable.workspaceID, run.workspaceID),
        eq(runTable.stageID, run.stageID!)
      )
    );
}
