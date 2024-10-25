import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { notPublic } from "./auth";
import { Stage } from "@console/core/app";
import { Invocation, Log } from "@console/core/log";
import { Storage } from "@console/core/storage";
import { Issue } from "@console/core/issue";
import { Replicache } from "@console/core/replicache";
import { z } from "zod";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
  GetQueryResultsCommand,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { zValidator } from "@hono/zod-validator";
import { Realtime } from "@console/core/realtime";
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
  .post(
    "/aws/tail",
    zValidator(
      "json",
      z.object({
        stageID: z.string(),
        logGroup: z.string(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      let start = Date.now() - 2 * 60 * 1000;
      console.log("tailing from", start);
      const config = await Stage.assumeRole(body.stageID);
      if (!config) throw new HTTPException(500);
      const client = new CloudWatchLogsClient(config);
      const sourcemapKey =
        `arn:aws:lambda:${config.region}:${config.awsAccountID}:function:` +
        body.logGroup.split("/").slice(3, 5).join("/");

      async function* fetchStreams(logGroup: string) {
        let nextToken: string | undefined;
        console.log("fetching streams for", logGroup);

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
        console.log("fetching logs for", streams.length, "streams");

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

      for await (const stream of fetchStreams(body.logGroup)) {
        streams.push(stream.logStreamName || "");
        if (streams.length === 100) break;
      }
      if (!streams.length) return;
      if (!start) start = Date.now() - 2 * 60 * 1000;

      console.log("fetching since", new Date(start).toLocaleString());
      const processor = Log.createProcessor({
        sourcemapKey,
        group: body.logGroup + "-tail",
        config,
      });

      for await (const event of fetchEvents(body.logGroup, start, streams)) {
        await processor.process({
          timestamp: event.timestamp!,
          line: event.message!,
          streamName: event.logStreamName!,
          id: event.eventId!,
        });
      }
      const data = processor.flush();
      return c.json(data);
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
      const invocations: Invocation[] = [];
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
        console.log("start", start.toLocaleString(DateTime.DATETIME_SHORT));

        const processor = Log.createProcessor({
          sourcemapKey:
            `arn:aws:lambda:${config.region}:${config.awsAccountID}:function:` +
            query.logGroup.split("/").slice(3, 5).join("/"),
          group: query.logGroup,
          config,
        });

        let flushed = 0;
        while (true) {
          console.log(
            "scanning from",
            start.toLocaleString(DateTime.DATETIME_SHORT),
            "to",
            end.toLocaleString(DateTime.DATETIME_SHORT),
          );
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
          console.log("created query", result.queryId);

          while (true) {
            const response = await client.send(
              new GetQueryResultsCommand({
                queryId: result.queryId,
              }),
            );

            if (response.status === "Complete") {
              const results = response.results || [];
              console.log("log insights results", results.length);

              let index = 0;

              async function flush() {
                const data = processor.flush(-1);
                console.log(
                  "flushing invocations",
                  data.length,
                  "flushed so far",
                  flushed,
                );
                if (data.length) {
                  flushed += data.length;
                  invocations.push(...data);
                }
              }

              let now = Date.now();
              for (const result of results.sort((a, b) =>
                a[0]!.value!.localeCompare(b[0]!.value!),
              )) {
                await processor.process({
                  id: index.toString(),
                  timestamp: new Date(result[0]?.value! + " Z").getTime(),
                  streamName: result[2]?.value!,
                  line: result[1]?.value!,
                });
                if (Date.now() - now > 10_000 && processor.ready) {
                  console.log("taking too long, flushing");
                  await flush();
                  if (flushed >= 50) return false;
                  now = Date.now();
                }
                index++;
              }
              await flush();
              if (flushed >= 50) {
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
        start: start!.toISO()!,
        invocations,
      });
    },
  );

function delay(iteration: number) {
  const hours = Math.pow(2, iteration) - 1;
  return hours * 60 * 60 * 1000;
}
