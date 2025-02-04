import type { Invocation, Log, LogEntry } from "@console/core/log/index";
import { bus } from "./bus";
import { createStore, produce } from "solid-js/store";
import { pipe, sortBy, uniqueBy } from "remeda";
import { createInitializedContext } from "../common/context";

export function isInvocation(entry: LogEntry): entry is Invocation {
  return "start" in entry;
}

export function isLog(entry: LogEntry): entry is Log {
  return "message" in entry;
}

export const { use: useLocalLogs, provider: LocalLogsProvider } =
  createInitializedContext("LocalLogs", () => {
    const [store, setStore] = createStore<{
      [source: string]: LogEntry[];
    }>({
      all: [],
    });

    bus.on("invocation", (invocations) => {
      setStore(
        produce((state) => {
          for (const invocation of invocations) {
            let store = state[invocation.source];
            if (!store) {
              store = [];
              state[invocation.source] = store;
            }
            mergeEntry(store, invocation, -1);
            mergeEntry(state.all, invocation, -1);
          }
        }),
      );
    });

    bus.on("function.invoked", (data) => {
      setStore(
        produce((state) => {
          let group = state[data.functionID];
          if (!group) state[data.functionID] = group = [];
          const invocation: Invocation = {
            start: Date.now(),
            cold: false,
            input: data.event,
            id: data.requestID,
            errors: [],
            logs: [],
            source: data.functionID,
          };
          group.push(invocation);
          state.all.push(invocation);
        }),
      );
    });

    bus.on("worker.stdout", (data) => {
      setStore(
        produce((state) => {
          let group = state[data.functionID];
          const invocation = group?.findLast(
            (i): i is Invocation =>
              isInvocation(i) && i.source === data.functionID,
          );
          if (!invocation) return;
          invocation.logs.push({
            id: Math.random().toString(),
            message: data.message,
            timestamp: Date.now(),
          });
        }),
      );
    });

    bus.on("function.success", (data) => {
      setStore(
        produce((state) => {
          let group = state[data.functionID];
          const invocation = group?.findLast(
            (i): i is Invocation =>
              isInvocation(i) && i.source === data.functionID,
          );
          if (!invocation) return;
          invocation.end = Date.now();
          invocation.output = data.body;
        }),
      );
    });

    bus.on("function.error", (data) => {
      setStore(
        produce((state) => {
          let group = state[data.functionID];
          const invocation = group?.findLast(
            (i): i is Invocation =>
              isInvocation(i) && i.source === data.functionID,
          );
          if (!invocation) return;
          invocation.errors.push({
            id: invocation.id,
            error: data.errorType,
            message: data.errorMessage,
            stack: data.trace.map((t: any) => ({
              raw: t,
            })),
            failed: true,
          });
        }),
      );
    });

    return {
      get(source: string) {
        return store[source] || [];
      },
      clear(source: string) {
        setStore(
          produce((state) => {
            state[source] = [];
          }),
        );
        bus.emit("log.cleared", { source });
      },
      ready: true,
    };
  });

export function createLogStore(direction: 1 | -1) {
  const [store, setStore] = createStore<LogEntry[]>([]);

  return {
    ingest(entries: LogEntry[]) {
      setStore(
        produce((state) => {
          for (const entry of entries) {
            mergeEntry(state, entry, direction);
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

function mergeEntry(state: LogEntry[], entry: LogEntry, direction: 1 | -1) {
  const exists =
    direction === 1
      ? state.findLast((i) => i.id === entry.id)
      : state.find((i) => i.id === entry.id);

  if (!exists) {
    if (isLog(entry))
      state.push(entry);
    if (isInvocation(entry))
      insert(state, entry, direction);
    return;
  }

  if (isLog(entry) && isLog(exists)) {
    exists.message = entry.message;
    exists.timestamp = entry.timestamp;
    return;
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

function insert(store: LogEntry[], entry: LogEntry, direction: 1 | -1) {
  const time = getTime(entry) * direction;
  let left = 0;
  let right = store.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = getTime(store[mid]) * direction;

    if (midTime === time) {
      store.splice(mid, 0, entry);
      return;
    } else if (midTime < time) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  store.splice(left, 0, entry);
}

function getTime(entry: LogEntry) {
  if (isInvocation(entry)) return entry.start;
  if (isLog(entry)) return entry.timestamp;
  return 0;
}
