import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { notPublic } from "./auth";
import { Stage } from "@console/core/app/stage";
import { Log, LogEntry } from "@console/core/log/index";
import stripAnsi from "strip-ansi";
import { Issue } from "@console/core/issue/index";
import { LambdaGrouper } from "@console/core/log/lambda";
import { Replicache } from "@console/core/replicache/index";
import { z } from "zod";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
  GetQueryResultsCommand,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { zValidator } from "@hono/zod-validator";
import { DateTime } from "luxon";

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

    await Issue.expand({
      group: groupID,
      stageID,
    });
    await Replicache.poke();
    return c.json({});
  })
  .get(
    "/aws/tail",
    zValidator(
      "query",
      z.object({
        stageID: z.string(),
        logGroup: z.string(),
        hint: z.enum(["normal", "lambda"]),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query");
      let start = Date.now() - 2 * 60 * 1000;
      console.log("tailing from", start);
      const config = await Stage.assumeRole(query.stageID);
      if (!config) throw new HTTPException(500);
      const client = new CloudWatchLogsClient(config);
      const sourcemapKey =
        `arn:aws:lambda:${config.region}:${config.awsAccountID}:function:` +
        query.logGroup.split("/").slice(3, 5).join("/");

      async function* fetchStreams(logGroup: string) {
        let nextToken: string | undefined;

        while (true) {
          try {
            const response = await client.send(
              new DescribeLogStreamsCommand({
                logGroupIdentifier: logGroup,
                nextToken: nextToken,
                orderBy: "LastEventTime",
                descending: true,
              }),
            );

            for (const logStream of response.logStreams || []) {
              yield logStream;
            }

            nextToken = response.nextToken;
            if (!nextToken) {
              break;
            }
          } catch (e) {
            break;
          }
        }
      }

      async function* fetchEvents(
        logGroup: string,
        startTime: number,
        streams: string[],
      ) {
        let nextToken: string | undefined;

        while (true) {
          const response = await client.send(
            new FilterLogEventsCommand({
              logGroupIdentifier: logGroup,
              // logStreamNames: streams,
              nextToken,
              startTime,
            }),
          );

          for (const event of response.events || []) {
            yield event;
          }

          nextToken = response.nextToken;
          if (!nextToken) {
            break;
          }
        }
      }

      const streams: string[] = [];

      for await (const stream of fetchStreams(query.logGroup)) {
        streams.push(stream.logStreamName || "");
        if (streams.length === 100) break;
      }
      if (!streams.length) return c.json([]);
      if (!start) start = Date.now() - 2 * 60 * 1000;

      if (query.hint === "normal") {
        const events = [];
        for await (const event of fetchEvents(query.logGroup, start, streams)) {
          events.push({
            id: event.eventId!,
            timestamp: event.timestamp!,
            message: stripAnsi(event.message!),
          });
        }
        console.log("got", events.length, "events");
        // take last 50 events
        return c.json(events.slice(-50));
      }

      if (query.hint === "lambda") {
        const grouper = LambdaGrouper();
        const data = [];
        for await (const event of fetchEvents(query.logGroup, start, streams)) {
          data.push(
            ...grouper.process({
              timestamp: event.timestamp!,
              line: event.message!,
              stream: event.logStreamName!,
              id: event.eventId!,
            }),
          );
        }
        data.sort((a, b) => b.start - a.start);
        const trimmed = data.slice(0, 50);
        for (const invocation of trimmed) {
          for (const log of invocation.logs) {
            if (!log.message) continue;
            log.message = stripAnsi(log.message);
          }
        }
        return c.json(trimmed);
      }
    },
  )
  .get(
    "/aws/past",
    zValidator(
      "query",
      z.object({
        logGroup: z.string(),
        stageID: z.string(),
        end: z.string().optional(),
        hint: z.enum(["normal", "lambda"]),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query");
      const config = await Stage.assumeRole(query.stageID);
      if (!config)
        throw new HTTPException(400, {
          message: "Failed to assume role for stage: " + query.stageID,
        });
      const client = new CloudWatchLogsClient(config);
      const entries: LogEntry[] = [];
      let end = query.end ? DateTime.fromISO(query.end) : DateTime.now();
      let start = query.end
        ? end.minus({ hours: 1 })
        : await (async () => {
            const response = await client
              .send(
                new DescribeLogStreamsCommand({
                  logGroupIdentifier: query.logGroup,
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
            return DateTime.fromMillis(
              response.logStreams?.[0]?.lastEventTimestamp! - 30 * 60 * 1000,
            ).startOf("hour");
          })();
      const result = await (async () => {
        let iteration = 0;

        if (!start) return;

        const grouper = LambdaGrouper();
        // const processor = Log.createProcessor({
        //   sourcemapKey:
        //     `arn:aws:lambda:${config.region}:${config.awsAccountID}:function:` +
        //     query.logGroup.split("/").slice(3, 5).join("/"),
        //   logGroup: `arn:aws:logs:${config.region}:${config.awsAccountID}:log-group:${query.logGroup}`,
        //   group: query.logGroup,
        //   config,
        // });

        while (true) {
          console.log("scanning from", start?.toISO(), "to", end.toISO());
          const result = await client
            .send(
              new StartQueryCommand({
                logGroupIdentifiers: [query.logGroup],
                queryString: `fields @timestamp, @message, @logStream | sort @timestamp desc, @logStream asc | limit 10000`,
                startTime: start.toMillis() / 1000,
                endTime: end.toMillis() / 1000,
              }),
            )
            .catch((ex) => {});
          if (!result) return true;
          console.log(result);

          while (true) {
            const response = await client.send(
              new GetQueryResultsCommand({
                queryId: result.queryId,
              }),
            );
            const results = response.results || [];

            if (response.status === "Complete") {
              if (query.hint === "lambda") {
                // process in ascending order, need to process all to get the last 50
                for (const result of results.toReversed()) {
                  const timestamp = new Date(result[0]?.value! + " Z");
                  entries.push(
                    ...grouper.process({
                      id: result[3]!.value!,
                      timestamp: timestamp.getTime(),
                      stream: result[2]?.value!,
                      line: result[1]?.value!,
                    }),
                  );
                }
              }

              if (query.hint === "normal") {
                for (const result of results) {
                  const timestamp = new Date(result[0]?.value! + " Z");
                  if (timestamp.getTime() >= end.toMillis()) {
                    continue;
                  }
                  const length = entries.push({
                    id: result[3]!.value!,
                    message: result[1]?.value!,
                    timestamp: timestamp.getTime(),
                  });
                  if (length >= 50) break;
                }
              }

              console.log(entries.length, "in buffer");

              if (entries.length >= 50) {
                return false;
              }

              break;
            }

            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          iteration++;
          end = start;
          start = start.minus({ millisecond: delay(iteration) });
        }
      })();

      entries.sort((a, b) => {
        const aTime = "timestamp" in a ? a.timestamp : a.start;
        const bTime = "timestamp" in b ? b.timestamp : b.start;
        return bTime - aTime;
      });
      console.log(entries.length, "entries before trimming");
      const trimmed = entries.slice(0, 50);
      const first = trimmed.at(-1);
      return c.json({
        completed: result,
        start: first
          ? new Date(
              "timestamp" in first ? first.timestamp : first.start,
            ).toISOString()
          : undefined,
        invocations: trimmed,
      });
    },
  )
  .get(
    "/aws/filter",
    zValidator(
      "query",
      z.object({
        stageID: z.string(),
        group: z.string(),
        start: z.coerce.number().optional(),
        next: z.string().optional(),
        hint: z.enum(["normal", "lambda"]),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query");
      const config = await Stage.assumeRole(query.stageID);
      if (!config) throw new HTTPException(500);
      const client = new CloudWatchLogsClient(config);

      const start = query.next
        ? undefined
        : await (async () => {
            const response = await client
              .send(
                new DescribeLogStreamsCommand({
                  logGroupIdentifier: query.group,
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

      console.log("start", start);
      const response = await client.send(
        new FilterLogEventsCommand({
          logGroupName: query.group,
          limit: 200,
          startTime: start,
          nextToken: query.next,
        }),
      );
      const entries = [] as LogEntry[];

      if (query.hint === "normal") {
        for await (const item of response.events || []) {
          entries.push({
            id: item.eventId!,
            timestamp: item.timestamp!,
            message: stripAnsi(item.message!),
          });
        }
      }

      if (query.hint === "lambda") {
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
    "/aws/scan",
    zValidator(
      "query",
      z.object({
        stageID: z.string(),
        requestID: z.string().optional(),
        timestamp: z.number({ coerce: true }).optional(),
        logGroup: z.string(),
        logStream: z.string(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("query");
      let start = Date.now() - 2 * 60 * 1000;
      console.log("tailing from", start);
      const config = await Stage.assumeRole(body.stageID);
      if (!config)
        throw new HTTPException(500, { message: "Failed to assume role" });
      const logs = await Log.scan({
        ...body,
        timestamp: body.timestamp || undefined,
        config,
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
