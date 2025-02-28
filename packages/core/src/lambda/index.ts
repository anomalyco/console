import { z } from "zod";
import { zod } from "../util/zod";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Stage } from "../app";
import { useTransaction } from "../util/transaction";
import { lambdaPayload } from "./lambda.sql";
import { useActor, useWorkspace } from "../actor";
import { createSelectSchema } from "drizzle-zod";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { disposable } from "../util/disposable";

export * as Lambda from ".";

export const invoke = zod(
  z.object({
    stageID: z.string(),
    functionARN: z.string(),
    payload: z.any(),
  }),
  async (input) => {
    const config = await Stage.assumeRole(input.stageID);
    if (!config) return;
    using client = disposable(
      () => new LambdaClient(config),
      (client) => client.destroy(),
    );
    const result = await client.send(
      new InvokeCommand({
        FunctionName: input.functionARN,
        Payload: Buffer.from(JSON.stringify(input.payload)),
        InvocationType: "Event",
      }),
    );
    return result.$metadata.requestId!;
  },
);

export const LambdaPayload = createSelectSchema(lambdaPayload, {
  id: (schema) => schema.id.cuid2(),
});
export type LambdaPayload = z.infer<typeof LambdaPayload>;

export const savePayload = zod(
  LambdaPayload.pick({
    id: true,
    name: true,
    key: true,
    payload: true,
  }).partial({
    id: true,
  }),
  (input) =>
    useTransaction(async (tx) => {
      const id = input.id || createId();
      await tx.insert(lambdaPayload).values({
        id,
        key: input.key,
        name: input.name,
        creator: useActor(),
        workspaceID: useWorkspace(),
        payload: input.payload,
      });
    }),
);

export const removePayload = zod(LambdaPayload.shape.id, (input) =>
  useTransaction(async (tx) => {
    await tx
      .delete(lambdaPayload)
      .where(
        and(
          eq(lambdaPayload.id, input),
          eq(lambdaPayload.workspaceID, useWorkspace()),
        ),
      );
    return input;
  }),
);
