import { bus } from "$/providers/bus";
import { LogEvent, StackFrame } from "@console/core/log";
import { pipe, sortBy, uniqueBy } from "remeda";
import { createStore, produce } from "solid-js/store";

export const [LogStore, setLogStore] = createStore<
  Record<string, Invocation[]>
>({
  all: [],
});

export function clearLogStore(input: string) {
  invocations.delete(input);
  setLogStore(
    produce((state) => {
      state[input] = [];
    }),
  );
}

export interface Invocation {
  id: string;
  group?: string;
  cold: boolean;
  event?: any;
  response?: any;
  errors: {
    id: string;
    type: string;
    message: string;
    stack: StackFrame[];
  }[];
  report?: {
    duration: number;
    size: number;
    memory: number;
    xray: string;
  };
  start: Date;
  end?: Date;
  logs: Log[];
}

interface Log {
  id?: string;
  timestamp: Date;
  message: string;
}

// stash log entries that come out of order before log start
const pendingEntries = new Map<string, Log[]>();
const invocations = new Map<string, Map<string, number>>();

bus.on("log.url", async (e) => {
  const data: LogEvent[] = await fetch(e).then((r) => r.json());
  console.time("log");
  console.log("processing", data.length);
  bus.emit("log", data);
  console.timeEnd("log");
});

bus.on("log", (data) => {
  const track = new Map<string, number>();
  setLogStore(
    produce((state) => {
      let currentGroup: string;
      function getInvocation(group: string, requestID: string) {
        currentGroup = group;
        const index = invocations.get(group)?.get(requestID);
        if (index === undefined || index < 0) return;
        return state[group]?.at(index);
      }
      for (const event of data) {
        performance.mark("start");
        switch (event.type) {
          case "start": {
            if (invocations.get(event.group)?.has(event.requestID)) break;
            let group = state[event.group];
            if (!group) state[event.group] = group = [];
            const pending = pendingEntries.get(event.requestID) || [];
            pendingEntries.delete(event.requestID);
            const invocation: Invocation = {
              id: event.requestID,
              start: new Date(event.timestamp),
              group: event.group,
              errors: [],
              cold: event.cold,
              logs: pending,
            };
            const index = group.push(invocation);
            state.all.push(invocation);
            let all = invocations.get(event.group);
            if (!all) invocations.set(event.group, (all = new Map()));
            all.set(event.requestID, index - 1);

            break;
          }
          case "message": {
            const log: Log = {
              id: event.id,
              timestamp: new Date(event.timestamp),
              message: event.message,
            };
            const invocation = getInvocation(event.group, event.requestID);
            let logs = invocation?.logs;
            if (!logs) {
              logs = pendingEntries.get(event.requestID);
              if (!logs) pendingEntries.set(event.requestID, (logs = []));
            }
            logs.push(log);
            break;
          }
          case "end": {
            const invocation = getInvocation(event.group, event.requestID);
            if (!invocation) break;
            invocation.end = new Date(event.timestamp);
            break;
          }
          case "report": {
            const invocation = getInvocation(event.group, event.requestID);
            if (!invocation) break;
            invocation.report = {
              duration: event.duration,
              size: event.size,
              memory: event.memory,
              xray: event.xray,
            };
            break;
          }
          case "error": {
            const invocation = getInvocation(event.group, event.requestID);
            if (!invocation) break;
            if (invocation.errors.find((e) => e.id === event.id)) break;
            invocation.errors.push({
              id: event.id,
              type: event.error,
              message: event.message,
              stack: event.stack,
            });
          }
        }
        performance.mark("end");
        const result = performance.measure(event.type, "start", "end");
        const avg = result.duration + (track.get(event.type) || 0);
        track.set(event.type, avg / 2);
      }

      for (const invocation of Object.values(state[currentGroup!] || {})) {
        invocation.logs = pipe(
          invocation.logs,
          uniqueBy((l) => l.id),
          sortBy((l) => l.timestamp),
        );
      }
    }),
  );
  // console.log(track);
});

bus.on("function.invoked", (e) => {
  bus.emit("log", [
    {
      type: "start",
      timestamp: Date.now(),
      group: e.functionID,
      requestID: e.requestID,
      cold: false,
    },
  ]);
  setLogStore(
    produce((state) => {
      let group = state[e.functionID];
      if (!group) return;
      const invocation = group.find((i) => i.id === e.requestID);
      if (!invocation) return;
      invocation.event = e.event;
    }),
  );
});

bus.on("worker.stdout", (e) => {
  bus.emit("log", [
    {
      type: "message",
      timestamp: Date.now(),
      group: e.functionID,
      requestID: e.requestID,
      message: e.message,
      level: "INFO",
      id: Math.random().toString(),
    },
  ]);
});

bus.on("function.success", (e) => {
  bus.emit("log", [
    {
      type: "end",
      timestamp: Date.now(),
      group: e.functionID,
      requestID: e.requestID,
    },
  ]);
  setLogStore(
    produce((state) => {
      let group = state[e.functionID];
      if (!group) return;
      const invocation = group.find((i) => i.id === e.requestID);
      if (!invocation) return;
      invocation.response = e.body;
    }),
  );
});

bus.on("function.error", (e) => {
  bus.emit("log", [
    {
      type: "end",
      timestamp: Date.now(),
      group: e.functionID,
      requestID: e.requestID,
    },
  ]);
  setLogStore(
    produce((state) => {
      let group = state[e.functionID];
      if (!group) return;
      const invocation = group.find((i) => i.id === e.requestID);
      if (!invocation) return;
      invocation.errors.push({
        id: invocation.id,
        type: e.errorType,
        message: e.errorMessage,
        stack: e.trace.map((t: any) => ({
          raw: t,
        })),
      });
    }),
  );
});
