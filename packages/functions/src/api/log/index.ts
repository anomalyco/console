import { lazy } from "../util/lazy";
import zlib from "zlib";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { AWS } from "../aws";
import { SourceMapConsumer } from "source-map";
import { filter, maxBy, pipe, sortBy } from "remeda";
import { zod } from "../util/zod";
import { z } from "zod";

export * as Log from "./index";
export { Search } from "./search";

type LogEventBase = {
  timestamp: number;
  group: string;
  requestID: string;
};

export type StackFrame = {
  raw?: string;
  file?: string;
  line?: number;
  column?: number;
  fn?: string;
  context?: string[];
  important?: boolean;
};

export interface Invocation {
  id: string;
  source: string;
  cold: boolean;
  input?: any;
  output?: any;
  errors: (ParsedError & { id: string })[];
  report?: {
    duration: number;
    init?: number;
    size: number;
    memory: number;
    xray: string;
  };
  start: number;
  end?: number;
  logs: Log[];
}

export interface Log {
  id: string;
  timestamp: number;
  message: string;
}

export type LogEvent = LogEventBase &
  (
    | {
        type: "end";
      }
    | { type: "start"; cold: boolean }
    | {
        type: "report";
        duration: number;
        size: number;
        memory: number;
        xray: string;
      }
    | {
        type: "message";
        level: string;
        message: string;
        id: string;
      }
    | {
        id: string;
        type: "error";
        error: string;
        message: string;
        stack: StackFrame[];
        failed: boolean;
      }
  );

export type LogEventType<T extends LogEvent["type"]> = Extract<
  LogEvent,
  { type: T }
>;

export type Processor = ReturnType<typeof createProcessor>;

export function createSourcemapCache(input: {
  config: StageCredentials;
  key: string;
}) {
  const s3bootstrap = new S3Client({
    ...input.config,
    retryStrategy: RETRY_STRATEGY,
  });
  const sourcemapCache = new Map<string, any>();

  const getBootstrap = lazy(() => AWS.Account.bootstrap(input.config));
  const sourcemapsMeta = lazy(async () => {
    const bootstrap = await getBootstrap();
    if (!bootstrap) return [];
    const result = await s3bootstrap
      .send(
        new ListObjectsV2Command({
          Bucket: bootstrap.bucket,
          Prefix: `sourcemap/${input.config.app}/${input.config.stage}/${input.key}`,
        }),
      )
      .catch(() => {});
    if (!result) return [];
    const maps = (result.Contents || []).map((item) => ({
      key: item.Key!,
      created: item.LastModified!.getTime(),
    }));
    return maps;
  });

  return {
    meta() {
      return sourcemapsMeta();
    },
    async get(number: number) {
      const match = pipe(
        await sourcemapsMeta(),
        filter((x) => x.created < number),
        maxBy((x) => x.created),
      );
      if (!match) return;
      if (sourcemapCache.has(match.key)) {
        return await new SourceMapConsumer(sourcemapCache.get(match.key)!);
      }
      const bootstrap = await getBootstrap();
      const content = await s3bootstrap.send(
        new GetObjectCommand({
          Bucket: bootstrap!.bucket,
          Key: match.key,
        }),
      );
      try {
        const raw = JSON.parse(
          zlib.unzipSync(await content.Body!.transformToByteArray()).toString(),
        );
        raw.sources = raw.sources.map((item: string) =>
          item.replaceAll("../", "").replaceAll("webpack://", ""),
        );
        sourcemapCache.set(match.key, raw);
        const consumer = await new SourceMapConsumer(raw);
        return consumer;
      } catch {
        return;
      }
    },
    destroy() {
      s3bootstrap.destroy();
      sourcemapCache.clear();
    },
  };
}

type SourcemapCache = ReturnType<typeof createSourcemapCache>;

export function createProcessor(input: {
  sourcemapKey?: string;
  group: string;
  config: StageCredentials;
}) {
  const pending = new Map<string, Invocation>();
  let finalized = new Array<Invocation>();
  const streams = new Map<
    string,
    {
      cold: boolean;
      unknown: {
        logs: Invocation["logs"];
        errors: Invocation["errors"];
      };
      requestID?: string;
    }
  >();
  const sourcemapCache = input.sourcemapKey
    ? createSourcemapCache({
        key: input.sourcemapKey,
        config: input.config,
      })
    : undefined;

  const { group } = input;

  return {
    async process(input: {
      id: string;
      line: string;
      timestamp: number;
      streamName: string;
    }) {
      let stream = streams.get(input.streamName);
      if (!stream) {
        stream = {
          cold: false,
          unknown: {
            logs: [],
            errors: [],
          },
          requestID: "",
        };
        streams.set(input.streamName, stream);
      }
      const tabs = input.line.split("\t").map((t) => t.trim());

      if (tabs[0]?.startsWith("INIT_START")) {
        stream.cold = true;
        return [];
      }

      if (tabs[0]?.startsWith("START")) {
        const splits = tabs[0].split(" ");
        const isCold = stream.cold;
        const id = splits[2]!;
        const invocation: Invocation = {
          id: splits[2]!,
          logs: stream.unknown.logs,
          errors: stream.unknown.errors,
          cold: isCold,
          start: input.timestamp,
          source: group,
        };
        pending.set(id, invocation);
        stream.cold = false;
        stream.unknown = {
          logs: [],
          errors: [],
        };
        stream.requestID = id;
        return;
      }

      if (tabs[0]?.startsWith("END")) {
        const splits = tabs[0].split(" ");
        const invocation = pending.get(splits[2]!);
        if (invocation) {
          invocation.end = input.timestamp;
          if (invocation.report) {
            pending.delete(invocation.id);
            finalized.push(invocation);
          }
        }
        return;
      }

      if (tabs[0]?.startsWith("REPORT")) {
        const requestID = tabs[0].split(" ")[2]!.trim();
        const invocation = pending.get(requestID);
        if (invocation) {
          invocation.report = {
            duration: parseInt(tabs[2]?.split(" ")[2] || "0"),
            size: parseInt(tabs[3]?.split(" ")[2] || "0"),
            memory: parseInt(tabs[4]?.split(" ")[3] || "0"),
            init: parseInt(tabs[5]?.split(" ")[2] || "0"),
            xray:
              tabs.find((line) => line.includes("XRAY"))?.split(" ")[2] || "",
          };
          if (invocation.end) {
            pending.delete(invocation.id);
            finalized.push(invocation);
          }
        }
        return;
      }

      const message = (() => {
        const result: LogEventType<"message"> = {
          type: "message",
          timestamp: input.timestamp,
          group,
          requestID: tabs[1]?.length === 36 ? tabs[1]! : stream.requestID || "",
          id: input.id,
          level: tabs[0]?.startsWith("[ERROR]") ? "ERROR" : "INFO",
          message: formatLogMessage(tabs),
        };

        // Timeout
        // ie. 2023-11-02T21:25:22.391Z 1bd06cd6-9e74-4154-b921-0951216f2ec6 Task timed out after 4.01 seconds
        if (tabs[0]?.substring(62)?.startsWith("Task timed out after")) {
          result.requestID = tabs[0].split(" ")[1]!;
          result.level = "ERROR";
          result.message = tabs[0].substring(62)!;
        }

        // NodeJS format
        else if (
          tabs[0]?.length === 24 &&
          (tabs[1]?.length === 36 || tabs[1] === "undefined")
        ) {
          result.level = tabs[2]!.trim();
          result.message = formatLogMessage(tabs.slice(3));
        }

        return result;
      })();

      let target = pending.get(message.requestID) ?? stream.unknown;

      if (message.level === "ERROR") {
        const err = extractError(tabs);
        if (err && sourcemapCache) {
          const mapped = await applySourcemap(
            sourcemapCache,
            input.timestamp,
            err,
          );
          target.errors.push({
            id: message.id,
            message: mapped.message,
            error: mapped.error,
            stack: mapped.stack,
            failed: mapped.failed,
          });
        }
      }
      target.logs.push(message);
      return;
    },
    flush(order = 1) {
      const sorted = sortBy(
        [...finalized, ...pending.values()],
        (invocation) => order * invocation.start,
      );
      finalized = [];
      return sorted;
    },
    destroy() {
      sourcemapCache?.destroy();
    },
    get streams() {
      return streams;
    },
    get ready() {
      return finalized.length;
    },
  };
}

import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { RETRY_STRATEGY } from "../util/aws";
import { StageCredentials } from "../app/stage";
import { extractJSON } from "../util/json";

export const expand = zod(
  z.object({
    timestamp: z.number(),
    group: z.string(),
    logGroup: z.string(),
    logStream: z.string(),
    config: z.custom<StageCredentials>(),
  }),
  async (input) => {
    const cw = new CloudWatchLogsClient({
      ...input.config,
      // retryStrategy: RETRY_STRATEGY,
    });

    const offset = 1000 * 60 * 15;

    const processor = createProcessor({
      config: input.config,
      group: input.group,
    });

    async function fetchEvents(start: number, end: number) {
      let nextToken: string | undefined;
      const result = [];
      const backwards = end === input.timestamp;
      while (true) {
        const response = await cw
          .send(
            new GetLogEventsCommand({
              logGroupName: input.logGroup,
              logStreamName: input.logStream,
              startTime: start,
              endTime: end,
              startFromHead: !backwards,
              nextToken,
            }),
          )
          .catch(() => {});
        if (!response) break;
        const events = pipe(
          response.events || [],
          sortBy(
            (evt) => (backwards ? -1 : 1) * evt.timestamp!,
            // @ts-ignore - eventId is not in the types
            (evt) => (backwards ? -1 : 1) * evt.eventId!,
          ),
        );

        for (const event of events) {
          if (
            backwards &&
            (event.message!.startsWith("REPORT") ||
              event.message!.startsWith("END"))
          )
            break;
          result.push(event);
          if (!backwards && event.message!.startsWith("REPORT")) break;
        }

        nextToken = response.nextForwardToken;
        if (!response.events?.length) {
          break;
        }
      }

      if (backwards) result.reverse();
      return result;
    }

    const events = await Promise.all([
      fetchEvents(input.timestamp - offset, input.timestamp),
      fetchEvents(input.timestamp, input.timestamp + offset),
    ]).then((r) => r.flat());

    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      await processor.process({
        streamName: input.logStream,
        timestamp: event.timestamp!,
        id: i.toString(),
        line: event.message!,
      });
    }

    cw.destroy();
    return processor.flush();
  },
);

export const scan = zod(
  z.object({
    timestamp: z.number().optional(),
    logGroup: z.string(),
    logStream: z.string(),
    requestID: z.string().optional(),
    config: z.custom<StageCredentials>(),
  }),
  async (input) => {
    console.log("scanning", input);
    const cw = new CloudWatchLogsClient({
      ...input.config,
      // retryStrategy: RETRY_STRATEGY,
    });
    const events = [];
    let limit = true;
    let nextToken: string | undefined;
    while (limit) {
      const response = await cw
        .send(
          new GetLogEventsCommand({
            logGroupName: input.logGroup,
            logStreamName: input.logStream,
            startTime: input.timestamp,
            startFromHead: true,
            nextToken,
          }),
        )
        .catch(() => {});
      if (!response) break;
      for (const event of response.events || []) {
        const tabs = event.message!.split("\t");
        if (tabs[0]?.length === 24) event.message = tabs.slice(3).join("\t");
        events.push(event);
        if (
          input.requestID &&
          event.message!.includes(input.requestID) &&
          event.message!.includes("REPORT")
        ) {
          limit = false;
          break;
        }
      }
      if (!response.nextForwardToken || response.nextForwardToken === nextToken)
        break;
      nextToken = response.nextForwardToken;
    }
    cw.destroy();
    return events;
  },
);

export type ParsedError = {
  error: string;
  message: string;
  stack: StackFrame[];
  failed: boolean;
};
export function extractError(tabs: string[]): ParsedError | undefined {
  // Lambda runtime error
  if (tabs.length === 1 && tabs[0]?.includes("LAMBDA_RUNTIME Failed")) {
    return {
      error: "LambdaRuntimeError",
      message: tabs[0]!.split("LAMBDA_RUNTIME")?.[1]?.trim() || "Unknown error",
      stack: [],
      failed: true,
    };
  }

  // Timeout
  if (tabs.length === 1 && tabs[0]?.includes("Task timed out after")) {
    return {
      error: "LambdaTimeoutError",
      message: tabs[0]?.substring(62) || "Timeout error",
      stack: [],
      failed: true,
    };
  }

  // Runtime exit error
  if (tabs.some((line) => line.includes("Runtime.ExitError"))) {
    return {
      error: "RuntimeExitError",
      message: tabs.join("\t"),
      stack: [],
      failed: true,
    };
  }

  // Generic AWS error handling
  if (
    tabs[3]?.includes("Invoke Error") ||
    tabs[3]?.includes("Uncaught Exception") ||
    tabs[3]?.includes("Unhandled Promise Rejection")
  ) {
    const parsed = JSON.parse(tabs[4]!);
    // powertools
    if (parsed.recordErrors?.length) {
      const [record] = parsed.recordErrors;
      return {
        error: record.errorType,
        message: record.errorMessage,
        stack: record.stack.map((raw: string) => ({ raw })),
        failed: true,
      };
    }
    if (typeof parsed.stack == "string") {
      parsed.stack = parsed.stack.split("\n");
    }
    return {
      error: parsed.errorType || parsed.name,
      message: parsed.errorMessage || parsed.message,
      stack: ((parsed.stack || []) as string[])
        .map((l: string) => l.trim())
        .filter((l: string) => l.startsWith("at "))
        .map((raw) => ({ raw })),
      failed: true,
    };
  }

  // NodeJS inline
  if (
    tabs[0]?.length === 24 &&
    (tabs[1]?.length === 36 || tabs[1] === "undefined") &&
    tabs[3]
  ) {
    const line = tabs[3];

    // JSON like
    if (line[0] === "{") {
      const parts = extractJSON(line);

      for (const part of parts) {
        // powertools
        if (part.recordErrors?.length) {
          const [record] = part.recordErrors;
          return {
            error: record.errorType,
            message: record.errorMessage,
            stack: record.stack.map((raw: string) => ({ raw })),
            failed: false,
          };
        }

        // logtail
        if (part.message && part.stack) {
          const [description, ...stack] = part.stack;
          if (!description || !description.match) {
            console.error(new Error("unexpected part " + part));
            continue;
          }
          const [_, error, message] =
            description!.match(/([A-Z]\w+): (.+)$/s) ?? [];
          return {
            error: error,
            message: message,
            stack: stack
              .map((l: string) => l.trim())
              .map((raw: string) => ({
                raw,
              })),
            failed: false,
          };
        }
      }
    }

    // default
    const [description, ...stack] = line.split(/\n\s{4}(?=at)/g);
    if (!description) return;
    if (description.startsWith("(node:")) return;
    const [error, message] = (() => {
      // Normal error
      const [_, error, message] =
        description!.match(/([A-Z\[][\w\]]+): (.+)$/s) ?? [];
      if (error && message) return [error, message];

      // No clue how to parse this
      if (stack.length)
        return [description.substring(0, 128), "Unknown message"];

      return [];
    })();
    if (!error || !message || !stack.length) return;
    return {
      error: error,
      message: message,
      stack: stack
        .map((l) => l.trim())
        .map((raw, index) => {
          // Last line sometimes has extra content after the file+line number
          if (index !== stack.length - 1) return raw;
          return raw.split("{")[0]!.trimEnd();
        })
        .map((raw) => ({
          raw,
        })),
      failed: false,
    };
  }
}

export async function applySourcemap(
  sourcemapCache: SourcemapCache,
  timestamp: number,
  error: ParsedError,
): Promise<ParsedError> {
  if (!error.stack.length) return error;
  const consumer = await sourcemapCache.get(timestamp);
  if (!consumer) return error;

  const result = error.stack.flatMap((item): StackFrame[] => {
    if (!item.raw?.includes("/var/task") || item.raw.includes("node_modules"))
      return [item];
    const [lineHint, columnHint] = item.raw!.match(/(\d+):(\d+)/) ?? [];
    if (!columnHint || !lineHint) return [];
    const column = parseInt(columnHint);
    const line = parseInt(lineHint);
    const original = (() => {
      try {
        return consumer.originalPositionFor({
          line,
          column,
        });
      } catch (ex) {
        console.error(ex);
      }
    })();

    if (!original?.source) return [];

    const lines =
      consumer.sourceContentFor(original.source, true)?.split("\n") || [];
    const min = Math.max(0, original.line! - 4);
    const ctx = lines.slice(
      min,
      Math.min(original.line! + 3, lines.length - 1),
    );

    return [
      {
        file: original.source,
        line: original.line!,
        column: original.column!,
        context: ctx,
        important: !original.source.startsWith("node_modules"),
      },
    ];
  });
  consumer.destroy();
  if (!result.length) return error;

  return {
    ...error,
    stack: result,
  };
}

function formatLogMessage(parts: string[]) {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part[0] === "{" && part.at(-1) === "}") {
      try {
        const parsed = JSON.parse(part);
        parts[i] = JSON.stringify(parsed, null, 2);
        continue;
      } catch {}
    }
    parts[i] = part;
  }

  return parts.join("\t").trim();
}
