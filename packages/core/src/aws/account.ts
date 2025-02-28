export * as Account from "./account";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { zod } from "../util/zod";
import { createId } from "@paralleldrive/cuid2";
import { createTransactionEffect, useTransaction } from "../util/transaction";
import { awsAccount } from "./aws.sql";
import { useWorkspace } from "../actor";
import { and, eq, sql } from "drizzle-orm";
import { bootstrap, bootstrapIon } from "./bootstrap";
export * from "./bootstrap";
import {
  CloudFormationClient,
  DeleteStackCommand,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  S3Client,
  PutBucketNotificationConfigurationCommand,
} from "@aws-sdk/client-s3";
import {
  CreateRoleCommand,
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  EntityAlreadyExistsException,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";

export const Info = createSelectSchema(awsAccount, {
  id: (schema) => schema.id.cuid2(),
  accountID: (schema) => schema.accountID.regex(/^[0-9]{12}$/),
  workspaceID: (schema) => schema.workspaceID.cuid2(),
});
export type Info = z.infer<typeof Info>;

export const Events = {
  Created: createEvent(
    "aws.account.created",
    z.object({
      awsAccountID: z.string().cuid2(),
    }),
  ),
  Removed: createEvent(
    "aws.account.removed",
    z.object({
      awsAccountID: z.string().cuid2(),
    }),
  ),
};

export const create = zod(
  Info.pick({ id: true, accountID: true }).partial({
    id: true,
  }),
  (input) =>
    useTransaction(async (tx) => {
      const id = input.id ?? createId();
      await tx
        .insert(awsAccount)
        .values({
          id,
          workspaceID: useWorkspace(),
          accountID: input.accountID,
        })
        .onDuplicateKeyUpdate({
          set: {
            timeFailed: null,
            timeDeleted: null,
            timeDiscovered: null,
          },
        });

      const existing = await tx
        .select({
          id: awsAccount.id,
        })
        .from(awsAccount)
        .where(
          and(
            eq(awsAccount.accountID, input.accountID),
            eq(awsAccount.workspaceID, useWorkspace()),
          ),
        )
        .then((rows) => rows.at(0));
      await createTransactionEffect(() =>
        bus.publish(Resource.Bus, Events.Created, {
          awsAccountID: existing!.id,
        }),
      );
      return id;
    }),
);

export const scan = zod(Info.shape.id, (input) =>
  useTransaction(async (tx) => {
    await tx
      .update(awsAccount)
      .set({
        timeDiscovered: null,
      })
      .where(
        and(
          eq(awsAccount.id, input),
          eq(awsAccount.workspaceID, useWorkspace()),
        ),
      );
    await createTransactionEffect(() =>
      bus.publish(Resource.Bus, Events.Created, {
        awsAccountID: input,
      }),
    );
  }),
);

export const fromID = zod(Info.shape.id, (accountID) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(awsAccount)
      .where(
        and(
          eq(awsAccount.id, accountID),
          eq(awsAccount.workspaceID, useWorkspace()),
        ),
      )
      .execute()
      .then((rows) => rows[0]),
  ),
);

export const fromExternalID = zod(Info.shape.accountID, (externalID) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(awsAccount)
      .where(
        and(
          eq(awsAccount.workspaceID, useWorkspace()),
          eq(awsAccount.accountID, externalID),
        ),
      )
      .execute()
      .then((rows) => rows[0]),
  ),
);

export const fromAccountID = zod(Info.shape.accountID, (accountID) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(awsAccount)
      .where(
        and(
          eq(awsAccount.accountID, accountID),
          eq(awsAccount.workspaceID, useWorkspace()),
        ),
      )
      .execute()
      .then((rows) => rows[0]),
  ),
);

import { DescribeRegionsCommand, EC2Client } from "@aws-sdk/client-ec2";
import { Replicache } from "../replicache";
import { db } from "../drizzle";
import { stage } from "../app/app.sql";
import { RETRY_STRATEGY } from "../util/aws";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Resource } from "sst";
import { createEvent } from "../event";
import { bus } from "sst/aws/bus";
import { State } from "../state";
import { Credentials } from ".";
import { disposable } from "../util/disposable";

export const regions = zod(
  bootstrap.schema.shape.credentials,
  async (credentials) => {
    using client = disposable(
      () =>
        new EC2Client({
          credentials,
        }),
      (client) => client.destroy(),
    );
    const regions = await client
      .send(new DescribeRegionsCommand({}))
      .then((r) => r.Regions || []);
    return [...new Set(regions.map((r) => r.RegionName!))];
  },
);

export const integrate = zod(
  z.object({
    awsAccountID: Info.shape.id,
    credentials: z.custom<Credentials>(),
  }),
  async (input) => {
    const account = await fromID(input.awsAccountID);
    await db
      .update(awsAccount)
      .set({
        timeDiscovered: null,
      })
      .where(
        and(
          eq(awsAccount.id, input.awsAccountID),
          eq(awsAccount.workspaceID, useWorkspace()),
        ),
      )
      .execute();
    await Replicache.poke();
    console.log("integrating account", account);
    if (!account) return;
    using iam = disposable(
      () =>
        new IAMClient({
          credentials: input.credentials,
        }),
      (client) => client.destroy(),
    );
    const suffix =
      Resource.App.stage !== "production" ? "-" + Resource.App.stage : "";
    const roleName = "SSTConsolePublisher" + suffix;
    await iam
      .send(
        new DeleteRolePolicyCommand({
          RoleName: roleName,
          PolicyName: "eventbus",
        }),
      )
      .catch(() => {});
    console.log("deleted role policy");
    await iam
      .send(
        new DeleteRoleCommand({
          RoleName: roleName,
        }),
      )
      .catch(() => {});
    console.log("deleted role");

    await iam
      .send(
        new CreateRoleCommand({
          RoleName: roleName,
          AssumeRolePolicyDocument: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  Service: "events.amazonaws.com",
                },
                Action: "sts:AssumeRole",
              },
            ],
          }),
        }),
      )
      .catch((err) => {
        if (err instanceof EntityAlreadyExistsException) return;
        throw err;
      });
    console.log("created role");

    await iam.send(
      new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: "eventbus",
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["events:PutEvents"],
              Resource: [Resource.Bus.arn],
            },
          ],
        }),
      }),
    );
    console.log("created role policy");

    const r = await regions(input.credentials);
    console.log("regions", r);

    for (const region of r) {
      const config = {
        credentials: input.credentials,
        region: region!,
      };
      console.log("integrating region", region);

      const bootstrapBuckets = await Promise.all([
        bootstrap(config),
        bootstrapIon(config),
      ]).then((items) => items.flatMap((x) => (x ? [x] : [])));
      if (!bootstrapBuckets.length) continue;

      using s3 = disposable(
        () => new S3Client({ ...config, retryStrategy: RETRY_STRATEGY }),
        (client) => client.destroy(),
      );
      using eb = disposable(
        () =>
          new EventBridgeClient({ ...config, retryStrategy: RETRY_STRATEGY }),
        (client) => client.destroy(),
      );

      for (const b of bootstrapBuckets) {
        console.log(region, "found", b.version, "bucket", b);

        const result = await s3
          .send(
            new PutBucketNotificationConfigurationCommand({
              Bucket: b.bucket,
              NotificationConfiguration: {
                EventBridgeConfiguration: {},
              },
            }),
          )
          .catch(() => {});
        if (!result) {
          console.log(region, "failed to update bucket notification");
          continue;
        }
        console.log(region, "updated bucket notifications");
      }

      await eb.send(
        new PutRuleCommand({
          Name: "SSTConsole" + suffix,
          State: "ENABLED",
          EventPattern: JSON.stringify({
            source: ["aws.s3"],
            detail: {
              bucket: {
                name: bootstrapBuckets.map((b) => b.bucket),
              },
            },
          }),
        }),
      );
      await eb.send(
        new PutTargetsCommand({
          Rule: "SSTConsole" + suffix,
          Targets: [
            {
              Arn: Resource.Bus.arn,
              Id: "SSTConsole",
              RoleArn: `arn:aws:iam::${account.accountID}:role/${roleName}`,
            },
          ],
        }),
      );
      console.log(region, "created eventbus rule");
      await State.scan({
        awsAccountID: input.awsAccountID,
        credentials: input.credentials,
        region,
      });
    }
    await db
      .update(awsAccount)
      .set({
        timeDiscovered: sql`CURRENT_TIMESTAMP()`,
      })
      .where(
        and(
          eq(awsAccount.id, input.awsAccountID),
          eq(awsAccount.workspaceID, useWorkspace()),
        ),
      );
    await Replicache.poke();
    console.log("done");
  },
);

export const disintegrate = zod(
  z.object({
    awsAccountID: Info.shape.id,
    credentials: z.custom<Credentials>(),
  }),
  async (input) => {
    using client = disposable(
      () =>
        new CloudFormationClient({
          credentials: input.credentials,
        }),
      (client) => client.destroy(),
    );
    await client.send(
      new DeleteStackCommand({ StackName: `SSTConsole-${useWorkspace()}` }),
    );
    client.destroy();
  },
);

export const disconnect = zod(Info.shape.id, (input) =>
  useTransaction(async (tx) => {
    await tx
      .update(awsAccount)
      .set({
        timeDeleted: sql`now()`,
      })
      .where(
        and(
          eq(awsAccount.id, input),
          eq(awsAccount.workspaceID, useWorkspace()),
        ),
      );

    await tx
      .update(stage)
      .set({
        timeDeleted: sql`now()`,
      })
      .where(
        and(
          eq(stage.awsAccountID, input),
          eq(stage.workspaceID, useWorkspace()),
        ),
      );
  }),
);
