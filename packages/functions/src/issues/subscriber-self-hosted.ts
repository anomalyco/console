import { unzipSync } from "zlib";
import { CloudWatchLogsEvent, CloudWatchLogsDecodedData } from "aws-lambda";
import { createHash } from "crypto";
import { uniqueBy } from "remeda";
import {
  applySourcemap,
  createSourcemapCache,
  extractError,
} from "@console/core/log/error";
import { formatUrl } from "@aws-sdk/util-format-url";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";

export async function handler(input: CloudWatchLogsEvent) {
  const decoded: CloudWatchLogsDecodedData = JSON.parse(
    unzipSync(Buffer.from(input.awslogs.data, "base64")).toString(),
  );
  console.log("error form", decoded.logGroup);
  const [_prefix, region, accountID, appName, stageName] =
    decoded.subscriptionFilters[0]?.split("#") || [];
  const sourcemapKey =
    `arn:aws:lambda:${region}:${accountID}:function:` +
    decoded.logGroup.split("/").slice(3, 5).join("/");
  const sourcemapCache = createSourcemapCache({
    key: sourcemapKey,
    logGroup: `arn:aws:logs:${region}:${accountID}:log-group:${decoded.logGroup}`,
    config: {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN!,
      },
      app: appName!,
      stage: stageName!,
      region: region!,
    },
  });
  const results = [];
  for (const item of decoded.logEvents) {
    const splits = item.message.split(`\t`).map((x) => x.trim());
    const extracted = extractError(splits);
    if (!extracted) {
      continue;
    }
    const err = await applySourcemap(sourcemapCache, item.timestamp, extracted);
    if (
      err.error !== "Runtime.HandlerNotFound" &&
      err.stack.length &&
      err.stack.every((frame) => !frame.context) &&
      (await sourcemapCache.meta()).length
    ) {
      // ???
    }

    if (!err.error || !err.message) {
      console.log("error was undefined for some reason", item);
      return;
    }

    const groupParts = (() => {
      const [important] = err.stack.filter((x) => x.important);

      if (err.error === "LambdaTimeoutError") {
        return [err.error, sourcemapKey];
      }

      if (important) {
        return [err.error, important.context?.[3]?.trim(), important.file];
      }

      const frames = err.stack
        .map((x) => {
          if (x.file) {
            return x.context?.[3] || x.file;
          }

          return x.raw!;
        })
        .map((x) => x.trim());
      return [err.error, frames[0]];
    })();

    const group = createHash("sha256")
      .update(groupParts.filter(Boolean).join("\n"))
      .digest("hex");

    results.push({
      group,
      timestamp: item.timestamp,
      err,
    });
  }

  const signer = new SignatureV4({
    region: process.env.AWS_REGION!,
    service: "sts",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.AWS_SESSION_TOKEN!,
    },
    sha256: Sha256,
  });
  const url = await signer.presign({
    method: "GET",
    headers: {
      host: "sts.amazonaws.com",
    },
    protocol: "https",
    hostname: "sts.amazonaws.com",
    path: "/",
    query: {
      Action: "GetCallerIdentity",
      Version: "2011-06-15",
      OutputFormat: "json",
    },
  });
  const identity = formatUrl(url);
  const unique = uniqueBy(results, (x) => x.group);
  await fetch(process.env.SST_API_URL! + "/ingest", {
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "aws.issue",
      properties: {
        app: appName!,
        stage: stageName!,
        region: region!,
        logGroup: decoded.logGroup,
        logStream: decoded.logStream,
        identity,
        issues: unique,
      },
    }),
    method: "POST",
  })
    .then((r) => r.json())
    .then((err) => console.log(JSON.stringify(err, null, 2)));
}
