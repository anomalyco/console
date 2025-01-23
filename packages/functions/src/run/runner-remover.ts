import type { Context } from "aws-lambda";
import { withActor } from "@console/core/actor";
import { AWS } from "@console/core/aws/index";
import { Run } from "@console/core/run/index";

export async function handler(evt: Run.RunnerRemoverEvent, context: Context) {
  const { workspaceID, runnerID, removeIfNotUsedAfter } = evt;
  await withActor(
    {
      type: "system",
      properties: {
        workspaceID,
      },
    },
    async () => {
      const runner = await Run.getRunnerByID(runnerID);
      if (!runner) return;

      // In use => Re-schedule
      if ((runner.timeRun?.getTime() ?? 0) > removeIfNotUsedAfter) {
        process.env.RUNNER_REMOVER_FUNCTION_ARN = context.invokedFunctionArn;
        await Run.scheduleRunnerRemover(runnerID);
        return;
      }

      // Not in use => Remove
      const awsAccount = await AWS.Account.fromID(runner.awsAccountID);
      if (!awsAccount) return;
      const credentials = await AWS.assumeRole(awsAccount?.accountID!);
      if (!credentials) return;
      await Run.removeRunner({ runner, credentials });
    },
  );
}
