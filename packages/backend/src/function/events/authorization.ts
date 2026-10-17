import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { Resource } from "sst";
import { Actor } from "@console/core/actor";
import { Account } from "@console/core/account/index";
import { app } from "@console/core/app/app.sql";
import { awsAccount } from "@console/core/aws/aws.sql";
import { runTable } from "@console/core/run/run.sql";
import { workspace } from "@console/core/workspace/workspace.sql";
import { useTransaction } from "@console/core/util/transaction";

export const Envelope = z.object({
  account: z.string().regex(/^\d{12}$/),
  region: z.string().min(1),
  source: z.string().min(1),
  "detail-type": z.string().min(1),
});

export async function internalActor(raw: unknown, metadata: unknown) {
  const envelope = Envelope.parse(raw);
  const account = Resource.Bus.arn.split(":")[4];
  if (
    !account ||
    envelope.account !== account ||
    envelope.source !== `${Resource.App.name}.${Resource.App.stage}`
  )
    throw new Error("Unexpected internal event publisher");
  const actor = z.object({ actor: Actor }).parse(metadata).actor;
  const active =
    actor.type === "account"
      ? await Account.authorize(actor.properties)
      : actor.type === "user"
        ? await Account.authorizeUser(
            actor.properties.userID,
            actor.properties.workspaceID,
          )
        : actor.type === "system"
          ? await useTransaction((tx) =>
              tx
                .select({ id: workspace.id })
                .from(workspace)
                .where(
                  and(
                    eq(workspace.id, actor.properties.workspaceID),
                    isNull(workspace.timeDeleted),
                  ),
                )
                .then((rows) => rows[0]),
            )
          : undefined;
  if (!active) throw new Error("Event actor is no longer active");
  return actor;
}

export const RunnerIdentity = z.object({
  workspaceID: z.string().cuid2(),
  runID: z.string().cuid2(),
});

// The envelope account is supplied by AWS, not detail. Hints only select a
// candidate; the live account, workspace, region and build must all match.
export async function runnerWorkspace(
  raw: z.infer<typeof Envelope>,
  hint: z.infer<typeof RunnerIdentity>,
  buildID: string,
) {
  const run = await useTransaction((tx) =>
    tx
      .select({ workspaceID: runTable.workspaceID, log: runTable.log })
      .from(runTable)
      .innerJoin(workspace, eq(workspace.id, runTable.workspaceID))
      .innerJoin(
        app,
        and(
          eq(app.workspaceID, runTable.workspaceID),
          eq(app.id, runTable.appID),
        ),
      )
      .innerJoin(
        awsAccount,
        and(
          eq(awsAccount.workspaceID, runTable.workspaceID),
          eq(awsAccount.accountID, runTable.awsAccountExternalID),
        ),
      )
      .where(
        and(
          eq(runTable.workspaceID, hint.workspaceID),
          eq(runTable.id, hint.runID),
          eq(awsAccount.accountID, raw.account),
          eq(runTable.region, raw.region),
          eq(runTable.active, true),
          isNull(runTable.timeCompleted),
          isNull(runTable.timeDeleted),
          isNull(app.timeDeleted),
          isNull(awsAccount.timeDeleted),
          isNull(workspace.timeDeleted),
        ),
      )
      .then((rows) => rows[0]),
  );
  if (!run) return;
  // StartBuild can deliver a notification before its result is committed.
  // Throw to use Lambda's normal retry instead of losing that notification.
  if (!run.log) throw new Error("Run build is not yet recorded");
  if (run.log.engine !== "codebuild") return;
  const project = run.log.logGroup.replace(/^\/aws\/codebuild\//, "");
  const expected = `arn:aws:codebuild:${raw.region}:${raw.account}:build/${project}:${run.log.logStream}`;
  if (buildID !== expected) return;
  return run.workspaceID;
}
