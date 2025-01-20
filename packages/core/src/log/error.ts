import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { filter, firstBy, pipe } from "remeda";
import { SourceMapConsumer } from "source-map";
import { unzipSync } from "zlib";
import { StackFrame } from ".";
import { extractJSON } from "../util/json";
import { Credentials } from "../aws";
import { lazy } from "../util/lazy";
import { bootstrap, bootstrapIon } from "../aws/bootstrap";

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

type SourcemapCache = ReturnType<typeof createSourcemapCache>;

export function createSourcemapCache(input: {
  config: {
    credentials: Credentials;
    app: string;
    stage: string;
    region: string;
  };
  logGroup?: string;
  key: string;
}) {
  const s3bootstrap = new S3Client({
    ...input.config,
  });
  const sourcemapCache = new Map<string, any>();

  const getBootstrap = lazy(() => bootstrap(input.config));
  const getBootstrapV3 = lazy(() => bootstrapIon(input.config));
  const sourcemapsMeta = lazy(async () => {
    const results = [] as {
      bucket: string;
      key: string;
      created: number;
    }[];
    const bootstrap = await getBootstrap();
    if (bootstrap) {
      const result = await s3bootstrap
        .send(
          new ListObjectsV2Command({
            Bucket: bootstrap.bucket,
            Prefix: `sourcemap/${input.config.app}/${input.config.stage}/${input.key}`,
          }),
        )
        .catch((e) => {
          console.error(e);
        });
      if (result) {
        const maps = (result.Contents || []).map((item) => ({
          bucket: bootstrap.bucket,
          key: item.Key!,
          created: item.LastModified!.getTime(),
        }));
        results.push(...maps);
      }
    }

    const bootstrapV3 = await getBootstrapV3();
    if (bootstrapV3 && input.logGroup) {
      const result = await s3bootstrap
        .send(
          new ListObjectsV2Command({
            Bucket: bootstrapV3.asset,
            Prefix: `sourcemap/` + input.logGroup,
          }),
        )
        .catch((e) => {
          console.error(e);
        });
      if (result) {
        const maps = (result.Contents || []).map((item) => ({
          bucket: bootstrapV3.asset,
          key: item.Key!,
          created: item.LastModified!.getTime(),
        }));
        results.push(...maps);
      }
    }
    return results;
  });

  return {
    meta() {
      return sourcemapsMeta();
    },
    async get(number: number) {
      const match = pipe(
        await sourcemapsMeta(),
        filter((x) => x.created < number),
        firstBy([(x) => x.created, "desc"]),
      );
      if (!match) return;
      if (sourcemapCache.has(match.key)) {
        return await new SourceMapConsumer(sourcemapCache.get(match.key)!);
      }
      const content = await s3bootstrap.send(
        new GetObjectCommand({
          Bucket: match.bucket,
          Key: match.key,
        }),
      );
      try {
        const isV3 = match.bucket.includes("sst-asset");
        const raw = JSON.parse(
          isV3
            ? await content.Body!.transformToString()
            : unzipSync(await content.Body!.transformToByteArray()).toString(),
        );
        raw.sources = raw.sources.map((item: string) =>
          item.replaceAll("../", "").replaceAll("webpack://", ""),
        );
        sourcemapCache.set(match.key, raw);
        const consumer = await new SourceMapConsumer(raw);
        return consumer;
      } catch (ex) {
        return;
      }
    },
    destroy() {
      s3bootstrap.destroy();
      sourcemapCache.clear();
    },
  };
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
