import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { notPublic } from "./auth";
import { Stage } from "@console/core/app";
import { Log } from "@console/core/log";
import { Storage } from "@console/core/storage";
import { Issue } from "@console/core/issue";
import { Replicache } from "@console/core/replicache";
import { z } from "zod";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { zValidator } from "@hono/zod-validator";
import { Realtime } from "@console/core/realtime";

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
    "/tail",
    zValidator(
      "json",
      z.object({
        stageID: z.string(),
        profileID: z.string(),
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
      if (data.length) {
        console.log("sending", data.length, "invocations");
        const url = await Storage.putEphemeral(JSON.stringify(data), {
          ContentType: "application/json",
        });
        await Realtime.publish("invocation.url", url, body.profileID);
      }
    },
  );
