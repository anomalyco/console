import { createHash } from "node:crypto";
import type DynamoDB from "aws-sdk/clients/dynamodb";
import { z } from "zod";
import { challengeLifetime, type Challenge, type Challenges } from "./code";

export const issuancePolicy = z.object({
  cooldown: z.coerce.number().int().min(1).default(60),
  emailHourly: z.coerce.number().int().min(1).default(10),
  globalMinute: z.coerce.number().int().min(1).default(20),
  globalHourly: z.coerce.number().int().min(1).default(120),
});
type Policy = z.infer<typeof issuancePolicy>;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function dynamoChallenges(
  dynamo: Pick<DynamoDB, "transactWriteItems" | "deleteItem">,
  table: () => string,
  policy: Policy,
  now = () => Math.floor(Date.now() / 1000),
): Challenges {
  const key = (c: Challenge) => ({
    pk: { S: "email:flow" },
    sk: { S: hash(JSON.stringify([c.email, c.flowID, c.impersonate])) },
  });
  return {
    async issue(c) {
      const time = now();
      const TableName = table();
      const budgets = [
        ["email:" + hash(c.email), 3600, policy.emailHourly],
        ["global", 60, policy.globalMinute],
        ["global", 3600, policy.globalHourly],
      ] as const;
      try {
        await dynamo
          .transactWriteItems({
            ClientRequestToken: c.challengeID,
            TransactItems: [
              {
                Update: {
                  TableName,
                  Key: {
                    pk: { S: "email:cooldown" },
                    sk: { S: hash(c.email) },
                  },
                  UpdateExpression: "SET nextSend = :next, expiry = :expiry",
                  ConditionExpression:
                    "attribute_not_exists(nextSend) OR nextSend <= :now",
                  ExpressionAttributeValues: {
                    ":next": { N: String(time + policy.cooldown) },
                    ":expiry": { N: String(time + policy.cooldown + 3600) },
                    ":now": { N: String(time) },
                  },
                },
              },
              ...budgets.map(([scope, window, limit]) => ({
                Update: {
                  TableName,
                  Key: {
                    pk: { S: "email:budget:" + scope },
                    sk: { S: `${window}:${Math.floor(time / window)}` },
                  },
                  UpdateExpression: "SET expiry = :expiry ADD #count :one",
                  ConditionExpression:
                    "attribute_not_exists(#count) OR #count < :limit",
                  ExpressionAttributeNames: { "#count": "count" },
                  ExpressionAttributeValues: {
                    ":expiry": {
                      N: String(
                        (Math.floor(time / window) + 1) * window + 3600,
                      ),
                    },
                    ":one": { N: "1" },
                    ":limit": { N: String(limit) },
                  },
                },
              })),
              {
                Put: {
                  TableName,
                  Item: {
                    ...key(c),
                    challengeID: { S: c.challengeID },
                    email: { S: c.email },
                    flowID: { S: c.flowID },
                    impersonate: { S: c.impersonate },
                    authorization: { S: c.authorization },
                    expiry: { N: String(time + challengeLifetime) },
                  },
                },
              },
            ],
          })
          .promise();
        return true;
      } catch (error) {
        // Conflicts/capacity/ambiguous failures are unavailable, not rate denials.
        if (
          error instanceof Error &&
          error.name === "TransactionCanceledException"
        ) {
          const parsed = z
            .object({
              CancellationReasons: z.array(
                z.object({ Code: z.string().optional() }),
              ),
            })
            .safeParse(error);
          if (
            parsed.success &&
            parsed.data.CancellationReasons.some(
              (r) => r.Code === "ConditionalCheckFailed",
            ) &&
            parsed.data.CancellationReasons.every(
              (r) =>
                !r.Code || ["None", "ConditionalCheckFailed"].includes(r.Code),
            )
          )
            return false;
        }
        throw error;
      }
    },
    async consume(c) {
      try {
        await dynamo
          .deleteItem({
            TableName: table(),
            Key: key(c),
            ConditionExpression:
              "challengeID = :id AND email = :email AND flowID = :flow AND impersonate = :impersonate AND #authorization = :authorization AND expiry > :now",
            ExpressionAttributeNames: { "#authorization": "authorization" },
            ExpressionAttributeValues: {
              ":id": { S: c.challengeID },
              ":email": { S: c.email },
              ":flow": { S: c.flowID },
              ":impersonate": { S: c.impersonate },
              ":authorization": { S: c.authorization },
              ":now": { N: String(now()) },
            },
          })
          .promise();
        return true;
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "ConditionalCheckFailedException"
        )
          return false;
        throw error;
      }
    },
  };
}
