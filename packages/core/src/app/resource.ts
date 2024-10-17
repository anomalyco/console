export * as Resource from "./resource";
import { resource } from "./app.sql";
import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import type { Credentials } from "../aws";
import { createEvent } from "../event";
import { z } from "zod";
import { zod } from "../util/zod";
import { useTransaction } from "../util/transaction";
import { and, eq, inArray } from "drizzle-orm";
import { useWorkspace } from "../actor";
import { RETRY_STRATEGY } from "../util/aws";

export const Events = {
  Updated: createEvent(
    "app.resource.updated",
    z.object({
      resourceID: z.string().min(1),
    }),
  ),
};

type Model = typeof resource.$inferSelect;

type Metadata =
  | {
      type: "WebSocketApi";
      data: Record<string, any>;
    }
  | {
      type: "Api";
      data: Record<string, any>;
    }
  | {
      type: "Bucket";
      data: Record<string, any>;
    }
  | {
      type: "Cron";
      data: Record<string, any>;
    }
  | {
      type: "NextjsSite";
      data: Record<string, any>;
    }
  | {
      type: "RemixSite";
      data: Record<string, any>;
    }
  | {
      type: "AstroSite";
      data: Record<string, any>;
    }
  | {
      type: "SvelteKitSite";
      data: Record<string, any>;
    }
  | {
      type: "SolidStartSite";
      data: Record<string, any>;
    }
  | {
      type: "AppSync";
      data: Record<string, any>;
    }
  | {
      type: "StaticSite";
      data: Record<string, any>;
    }
  | {
      type: "ApiGatewayV1Api";
      data: Record<string, any>;
    }
  | {
      type: "Table";
      data: Record<string, any>;
    }
  | {
      type: "RDS";
      data: Record<string, any>;
    }
  | {
      type: "EventBus";
      data: Record<string, any>;
    }
  | {
      type: "Queue";
      data: Record<string, any>;
    }
  | {
      type: "Topic";
      data: Record<string, any>;
    }
  | {
      type: "KinesisStream";
      data: Record<string, any>;
    }
  | {
      type: "Cognito";
      data: Record<string, any>;
    }
  | {
      type: "Auth";
      data: Record<string, any>;
    }
  | {
      type: "Script";
      data: Record<string, any>;
    }
  | {
      type: "SlsNextjsSite";
      data: Record<string, any>;
    }
  | {
      type: "Service";
      data: Record<string, any>;
    }
  | {
      type: "Job";
      data: Record<string, any>;
    }
  | {
      type: "Stack";
      data: Record<string, any>;
    }
  | {
      type: "Function";
      data: Record<string, any>;
    };

export type Info = {
  [key in Metadata["type"]]: Model & {
    type: key;
    metadata: Extract<Metadata, { type: key }>["data"];
    enrichment: key extends keyof typeof Enrichers
      ? Awaited<ReturnType<(typeof Enrichers)[key]>>
      : {};
  };
}[Metadata["type"]];

export type InfoByType<Type extends Info["type"]> = Extract<
  Info,
  { type: Type }
>;

export const Enrichers = {
  async Function(resource, credentials, region) {
    const client = new LambdaClient({
      credentials,
      region,
      retryStrategy: RETRY_STRATEGY,
    });
    const info = await client.send(
      new GetFunctionCommand({
        FunctionName: resource.data.arn,
      }),
    );
    client.destroy();
    return {
      size: info.Configuration?.CodeSize,
      runtime: info.Configuration?.Runtime,
      live: Boolean(
        info.Configuration?.Environment?.Variables?.SST_FUNCTION_ID,
      ),
    };
  },
  async WebSocketApi() {
    return { cloudfrontUrl: "" };
  },
  async Stack(resource, credentials, region) {
    const client = new CloudFormationClient({
      credentials,
      region,
      retryStrategy: RETRY_STRATEGY,
    });
    const result = await client.send(
      new DescribeStacksCommand({
        StackName: resource.id,
      }),
    );
    client.destroy();
    const [stack] = result.Stacks || [];
    const parsed = JSON.parse(
      stack?.Outputs?.find((o) => o.OutputKey === "SSTMetadata")?.OutputValue ||
        "{}",
    );
    return {
      outputs:
        stack?.Outputs?.filter(
          (o) =>
            o.OutputKey !== "SSTMetadata" && !o.OutputKey?.startsWith("Export"),
        ) || [],
      version: parsed.version as string | undefined,
    } as const;
  },
} satisfies {
  [key in Metadata["type"]]?: (
    resource: {
      id: string;
      data: Extract<Metadata, { type: key }>["data"];
    },
    credentials: Credentials,
    region: string,
  ) => Promise<any>;
};

export const fromID = zod(z.string().min(1), (id) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(resource)
      .where(and(eq(resource.workspaceID, useWorkspace()), eq(resource.id, id)))
      .execute()
      .then((x) => x[0]),
  ),
);

export const enrich = zod(
  z.object({
    resourceID: z.string().min(1),
    credentials: z.custom<Credentials>(),
    region: z.string(),
  }),
  (input) =>
    useTransaction(async () => {
      const resource = await fromID(input.resourceID);
      if (!resource) return;
      const enricher = Enrichers[resource.type as keyof typeof Enrichers];
      if (!enricher) return;
      await enricher(
        {
          id: resource.cfnID,
          data: resource.metadata as any,
        },
        input.credentials,
        input.region,
      );
    }),
);

export const listFromStageID = zod(
  z.object({
    stageID: z.string().min(1),
    types: z.array(z.string().min(1)),
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .select()
        .from(resource)
        .where(
          and(
            eq(resource.workspaceID, useWorkspace()),
            eq(resource.stageID, input.stageID),
            inArray(resource.type, input.types),
          ),
        )
        .execute()
        .then((rows) => rows as Info[]),
    ),
);
