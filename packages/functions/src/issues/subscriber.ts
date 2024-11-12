import { Issue } from "@console/core/issue";
import { unzipSync } from "zlib";
import { withActor } from "@console/core/actor";
import { KinesisStreamEvent } from "aws-lambda";
import { queue } from "@console/core/util/queue";

export const handler = async (event: KinesisStreamEvent) =>
  withActor(
    {
      type: "public",
      properties: {},
    },
    async () => {
      console.log("got", event.Records.length, "records");
      const incomplete: string[] = event.Records.map(
        (r) => r.eventID,
      ).reverse();
      await queue(5, event.Records, async (record) => {
        console.log(
          "arrival",
          new Date(
            record.kinesis.approximateArrivalTimestamp * 1000,
          ).toISOString(),
          new Date().toISOString(),
          "diff",
          Date.now() - record.kinesis.approximateArrivalTimestamp * 1000,
        );
        if (
          Date.now() - record.kinesis.approximateArrivalTimestamp * 1000 >
          1000 * 60 * 60
        ) {
          incomplete.pop();
          console.log("too old");
          return;
        }
        const decoded = JSON.parse(
          unzipSync(Buffer.from(record.kinesis.data, "base64")).toString(),
        );
        if (decoded.messageType !== "DATA_MESSAGE") {
          incomplete.pop();
          return;
        }
        try {
          await Issue.extract(decoded);
          incomplete.pop();
        } catch (ex) {
          console.error(ex);
        }
      });

      console.log("incomplete", incomplete.length);
      const response = {
        batchItemFailures: incomplete.map((id) => ({
          itemIdentifier: id,
        })),
      };

      return response;
    },
  );
