import { createEmitter } from "@solid-primitives/event-bus";
import type { Invocation, LogEvent } from "@console/core/log";

export const bus = createEmitter<{
  poke: {
    workspaceID: string;
  };
  log: LogEvent[];
  "log.url": string;
  "bar.show": boolean;
  "invocation.url": string;
  invocation: Invocation[];
  "log.cleared": {
    source: string;
  };
  //  TODO: fix types
  "worker.stdout": any; // Events["worker.stdout"];
  "function.invoked": any; // Events["function.invoked"];
  "function.success": any; // Events["function.success"];
  "function.error": any; // Events["function.error"];
  "cli.dev": {
    stage: string;
    app: string;
  };
}>();
