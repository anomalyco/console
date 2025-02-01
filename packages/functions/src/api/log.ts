import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { notPublic } from "./auth";
import { Stage } from "@console/core/app/stage";
import { Log, LogEntry } from "@console/core/log/index";
import stripAnsi from "strip-ansi";
import { Issue } from "@console/core/issue/index";
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
              logStreamNames: streams,
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
        const processor = Log.createProcessor({
          sourcemapKey,
          logGroup: `arn:aws:logs:${config.region}:${config.awsAccountID}:log-group:${query.logGroup}`,
          group: query.logGroup + "-tail",
          config,
        });

        for await (const event of fetchEvents(query.logGroup, start, streams)) {
          await processor.process({
            timestamp: event.timestamp!,
            line: event.message!,
            streamName: event.logStreamName!,
            id: event.eventId!,
          });
        }
        console.log("got", processor.ready, "invocations");
        const data = processor.flush().slice(-50);
        for (const invocation of data) {
          for (const log of invocation.logs) {
            if (!log.message) continue;
            log.message = stripAnsi(log.message);
          }
        }
        return c.json(data);
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
      let next = start?.toISO();
      const result = await (async () => {
        let iteration = 0;

        if (!start) return;

        const processor = Log.createProcessor({
          sourcemapKey:
            `arn:aws:lambda:${config.region}:${config.awsAccountID}:function:` +
            query.logGroup.split("/").slice(3, 5).join("/"),
          logGroup: `arn:aws:logs:${config.region}:${config.awsAccountID}:log-group:${query.logGroup}`,
          group: query.logGroup,
          config,
        });

        while (true) {
          const result = await client
            .send(
              new StartQueryCommand({
                logGroupIdentifiers: [query.logGroup],
                queryString: `fields @timestamp, @message, @logStream | sort @timestamp desc | limit 10000`,
                startTime: start.toMillis() / 1000,
                endTime: end.toMillis() / 1000,
              }),
            )
            .catch((ex) => {});
          if (!result) return true;

          while (true) {
            const response = await client.send(
              new GetQueryResultsCommand({
                queryId: result.queryId,
              }),
            );
            const results = response.results || [];

            if (response.status === "Complete") {
              if (query.hint === "lambda") {
                results.sort((a, b) =>
                  a[0]!.value!.localeCompare(b[0]!.value!),
                );
                let index = 0;

                async function flush() {
                  const data = processor.flush(-1);
                  if (data.length) {
                    entries.push(...data);
                  }
                }

                // process in ascending order, need to process all to get the last 50
                for (const result of results) {
                  const timestamp = new Date(result[0]?.value! + " Z");
                  await processor.process({
                    id: index.toString(),
                    timestamp: timestamp.getTime(),
                    streamName: result[2]?.value!,
                    line: result[1]?.value!,
                  });
                  index++;
                  if (!next || timestamp.toISOString() < next)
                    next = timestamp.toISOString();
                }
                await flush();
              }

              if (query.hint === "normal") {
                results.sort((b, a) =>
                  a[0]!.value!.localeCompare(b[0]!.value!),
                );
                // process in descending order, can stop after 50
                for (const result of results) {
                  const timestamp = new Date(result[0]?.value! + " Z");
                  const length = entries.unshift({
                    id: result[3]!.value!,
                    message: result[1]?.value!,
                    timestamp: timestamp.getTime(),
                  });
                  if (!next || timestamp.toISOString() < next)
                    next = timestamp.toISOString();
                  if (length >= 50) {
                    break;
                  }
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

      return c.json({
        completed: result,
        start: next,
        invocations: entries.slice(-50),
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
