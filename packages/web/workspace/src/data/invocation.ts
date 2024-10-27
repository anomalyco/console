import type { Invocation, Log, LogEntry } from "@console/core/log";
import { pipe, sortBy, uniqueBy } from "remeda";
import { createStore, produce } from "solid-js/store";

export function isInvocation(entry: LogEntry): entry is Invocation {
  return "start" in entry;
}

export function isLog(entry: LogEntry): entry is Log {
  return "message" in entry;
}

export function createLogStore() {
  const [store, setStore] = createStore<LogEntry[]>([]);

  return {
    ingest(entries: LogEntry[]) {
      setStore(
        produce((state) => {
          for (const entry of entries) {
            const exists = state.findLast((i) => i.id === entry.id);
            if (!exists) {
              state.push(entry);
              continue;
            }

            if (isLog(entry) && isLog(exists)) {
              exists.message = entry.message;
              exists.timestamp = entry.timestamp;
              continue;
            }

            // merge safely with existing invocation
            // invocations from server could be partial
            if (isInvocation(entry) && isInvocation(exists)) {
              if (exists && !exists.report) {
                if (entry.end) exists.end = entry.end;
                if (entry.input) exists.input = entry.input;
                if (entry.output) exists.output = entry.output;
                if (entry.errors) {
                  exists.errors.push(...entry.errors);
                  exists.errors = uniqueBy(entry.errors, (e) => e.id);
                }
                if (entry.report) exists.report = entry.report;
                if (entry.start) exists.start = entry.start;
                if (entry.end) exists.end = entry.end;
                if (entry.logs) {
                  exists.logs.push(...entry.logs);
                  exists.logs = pipe(
                    entry.logs,
                    uniqueBy((e) => e.id),
                    sortBy((e) => e.timestamp),
                  );
                }
              }
            }
          }
        }),
      );
    },
    get all() {
      return store;
    },
    clear() {
      setStore(produce((state) => state.splice(0)));
    },
  };
}
