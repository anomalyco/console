import { z } from "zod";
import { zod } from "../util/zod";
import type { Credentials } from "./index";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export const bootstrap = zod(
  z.object({
    credentials: z.custom<Credentials>(),
    region: z.string(),
  }),
  async (input) => {
    const cf = new CloudFormationClient(input);

    const bootstrap = await cf
      .send(
        new DescribeStacksCommand({
          StackName: "SSTBootstrap",
        }),
      )
      .catch((err) => {});

    if (bootstrap) {
      const bucket = bootstrap.Stacks?.at(0)?.Outputs?.find(
        (x) => x.OutputKey === "BucketName",
      )?.OutputValue;

      if (!bucket) {
        return;
      }

      return {
        bucket,
        version: "v2" as const,
      };
    }

    // try to find stack if it's named something different
    /*
    let paging: string | undefined;
    while (true) {
      const all = await cf.send(new DescribeStacksCommand({}));
      paging = all.NextToken;

      const [bucket] = (all.Stacks || []).map(
        (s) => s.Outputs?.find((o) => o.OutputKey === "BucketName")?.OutputValue
      );
      if (bucket) return { bucket };
      if (!paging) break;
    }
    */
  },
);

export const bootstrapIon = zod(
  z.object({
    credentials: z.custom<Credentials>(),
    region: z.string(),
  }),
  async (input) => {
    const ssm = new SSMClient(input);
    try {
      const param = await ssm
        .send(
          new GetParameterCommand({
            Name: "/sst/bootstrap",
          }),
        )
        .catch((err) => {});
      if (!param?.Parameter?.Value) return;
      const parsed = JSON.parse(param.Parameter.Value);
      return {
        bucket: parsed.state,
        asset: parsed.asset,
        version: "v3" as const,
      };
    } catch {
      return;
    } finally {
      ssm.destroy();
    }
  },
);
