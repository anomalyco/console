import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { notPublic } from "./auth";
import { Stage } from "@console/core/app/stage";
import { Log, LogEntry } from "@console/core/log/index";
import stripAnsi from "strip-ansi";
import { LambdaGrouper } from "@console/core/log/lambda";
import { Replicache } from "@console/core/replicache/index";
import { z } from "zod";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { zValidator } from "@hono/zod-validator";
import { DateTime } from "luxon";
import { AWS } from "@console/core/aws/index";
import { logger } from "@console/core/util/log";
import { disposable } from "@console/core/util/disposable";
import { useWorkspace } from "@console/core/actor";

export const LogRoute = new Hono()
  .use(notPublic)
  .get("/", async (c) => {
    const pointer = JSON.parse(c.req.query("pointer") || "{}");
    const stageID = c.req.query("stageID")!;
    const groupID = c.req.query("groupID")!;

    const config = await Stage.assumeRole(stageID);
    if (!config) {
      throw new HTTPException(400);
    }

    if (groupID.length !== 64) {
      const result = await Log.expand({
        group: groupID,
        logGroup: pointer.logGroup,
        logStream: pointer.logStream,
        timestamp: pointer.timestamp,
        config,
      });
      return c.json(result);
    }

    await Replicache.poke();
    return c.json({});
  })
  .get(
    "/aws/filter",
    zValidator(
      "query",
      z.object({
        stageID: z.string(),
        group: z.string(),
        stream: z.string().optional(),
        start: z.coerce.number().optional(),
        next: z.string().optional(),
        hint: z.enum(["normal", "lambda"]),
        pattern: z.string().optional(),
      }),
    ),
    async (c) => {
      const log = logger();
      log.tag("service", "aws-log");
      log.tag("workspace", useWorkspace());

      const query = c.req.valid("query");
      const config = await Stage.assumeRole(query.stageID);
      if (!config) throw new HTTPException(500);
      using client = disposable(
        () => new CloudWatchLogsClient(config),
        (client) => client.destroy(),
      );

      const start = query.start
        ? query.start
        : await (async () => {
            const response = await client
              .send(
                new DescribeLogStreamsCommand({
                  logGroupIdentifier: query.group,
                  logStreamNamePrefix: query.stream,
                  orderBy: "LastEventTime",
                  descending: true,
                  limit: 1,
                }),
              )
              .catch((ex) => {
                if (ex.name === "ResourceNotFoundException") return;
                throw ex;
              });
            if (!response) return;
            return (
              response.logStreams?.[0]?.lastEventTimestamp! - 5 * 60 * 1000
            );
          })();

      log.info("start", start, "stream", query.stream);
      const response = await client.send(
        new FilterLogEventsCommand({
          logGroupName: query.group,
          logStreamNames: query.stream ? [query.stream] : undefined,
          limit: 1000,
          startTime: start,
          filterPattern: query.pattern,
          nextToken: query.next,
        }),
      );
      log.info("got", response.events?.length, "events");
      const entries = [] as LogEntry[];

      if (query.hint === "normal" || query.pattern || query.stream) {
        for await (const item of response.events || []) {
          let message = stripAnsi(item.message!);

          // 2025-01-13T01:09:52.749Z	e3ee3739-3d0e-440c-bd2e-ffe9e74c6897	INFO	<-- POST /github/webhook
          if (query.hint === "lambda")
            message = message.replace(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\t/,
              "",
            );

          entries.push({
            id: item.eventId!,
            timestamp: item.timestamp!,
            stream: query.pattern ? item.logStreamName! : undefined,
            message,
          });
        }
      } else if (query.hint === "lambda") {
        const grouper = LambdaGrouper();
        for await (const event of response.events || []) {
          entries.push(
            ...grouper.process({
              timestamp: event.timestamp!,
              line: stripAnsi(event.message!),
              stream: event.logStreamName!,
              id: event.eventId!,
            }),
          );
        }
      }

      return c.json({
        next: response.nextToken,
        start,
        entries,
      });
    },
  )
  .get(
    "/aws/expand",
    zValidator(
      "query",
      z.object({
        stageID: z.string(),
        group: z.string(),
        stream: z.string(),
        timestamp: z.coerce.number(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query");
      console.log("expanding", query);
      const config = await Stage.assumeRole(query.stageID);
      if (!config) throw new HTTPException(500);

      using client = disposable(
        () => new CloudWatchLogsClient(config),
        (client) => client.destroy(),
      );

      if (query.group.includes("/aws/lambda")) {
        const result = await Log.expand({
          group: query.group,
          config,
          timestamp: query.timestamp,
          logGroup: query.group,
          logStream: query.stream,
        });
        if (result) return c.json(result);
      }

      const events = [] as Log[];
      for (const direction of [true, false]) {
        const response = await client.send(
          new GetLogEventsCommand({
            logGroupName: query.group,
            logStreamName: query.stream,
            ...(direction
              ? { startTime: query.timestamp }
              : {
                  endTime: query.timestamp,
                }),
            startFromHead: direction,
            limit: 25,
          }),
        );
        for (const event of response.events || []) {
          const timestamp = DateTime.fromMillis(event.timestamp!);
          events.push({
            id: events.length.toString(),
            timestamp: timestamp.toMillis(),
            stream: query.stream,
            message: event.message!,
          });
        }
      }

      return c.json(events.toSorted((a, b) => a.timestamp - b.timestamp));
    },
  )
  .get(
    "/aws/scan",
    zValidator(
      "query",
      z.object({
        awsAccountExternalID: z.string().optional(),
        region: z.string().optional(),
        stageID: z.string().optional(),
        requestID: z.string().optional(),
        timestamp: z.number({ coerce: true }).optional(),
        logGroup: z.string(),
        logStream: z.string(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("query");
      const config = body.stageID
        ? await Stage.assumeRole(body.stageID)
        : await (async () => {
            const credentials = await AWS.assumeRole(
              body.awsAccountExternalID!,
            );
            if (!credentials) return;
            return {
              region: body.region!,
              credentials: credentials!,
            };
          })();
      if (!config)
        throw new HTTPException(500, { message: "Failed to assume role" });
      const logs = await Log.scan({
        ...body,
        timestamp: body.timestamp || undefined,
        region: config.region,
        credentials: config.credentials,
      });
      for (const log of logs) {
        if (!log.message) continue;
        log.message = stripAnsi(log.message);
      }
      return c.json(logs);
    },
  );

function delay(iteration: number) {
  const hours = Math.pow(2, iteration) - 1;
  return hours * 60 * 60 * 1000;
}
