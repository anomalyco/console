import { withActor } from "@console/core/actor";
import { Issue } from "@console/core/issue/index";
import { SQSHandler } from "aws-lambda";

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const parsed = JSON.parse(
      record.body,
    ) as typeof Issue.Events.IssueDetected.$payload;
    await withActor(parsed.metadata.actor, async () => {
      await Issue.Send.triggerIssue(parsed.properties);
    });
  }
};
