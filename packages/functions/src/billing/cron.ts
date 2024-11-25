import { Stage } from "@console/core/app/stage";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import { chunk } from "remeda";
import { createId } from "@console/core/util/sql";

const sqs = new SQSClient({});
export async function handler() {
  let cursor: Awaited<ReturnType<typeof Stage.list>>["cursor"];

  do {
    const ret = await Stage.list({ cursor });
    const stages = ret.items;
    cursor = ret.cursor;

    console.log("stages", stages.length);
    let index = 0;
    for (const stage of chunk(stages, 10)) {
      await sqs.send(
        new SendMessageBatchCommand({
          QueueUrl: Resource.BillingQueue.url,
          Entries: stage.map((stage) => ({
            Id: createId(),
            MessageDeduplicationId: createId(),
            MessageBody: JSON.stringify({
              stageID: stage.id,
              workspaceID: stage.workspaceID,
            }),
            MessageGroupId: (index++ % 10).toString(),
          })),
        }),
      );
    }
  } while (cursor !== undefined);
}
