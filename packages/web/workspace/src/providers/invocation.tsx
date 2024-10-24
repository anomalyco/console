import { createInitializedContext } from "$/common/context";
import type { Invocation, ParsedError } from "@console/core/log";
import { bus } from "./bus";
import { createStore, produce } from "solid-js/store";
import { pipe, sortBy, uniqueBy } from "remeda";

export const { use: useInvocations, provider: InvocationProvider } =
  createInitializedContext("InvocationProvider", () => {
    const [store, setStore] = createStore<{
      [source: string]: Invocation[];
    }>({
      all: [],
    });
    bus.on("invocation.url", async (e) => {
      const data: Invocation[] = await fetch(e).then((r) => r.json());
      bus.emit("invocation", data);
    });

    bus.on("invocation", (invocations) => {
      setStore(
        produce((state) => {
          for (const invocation of invocations) {
            let source = state[invocation.source];
            if (!source) state[invocation.source] = source = [];
            const exists = source.findLast((i) => i.id === invocation.id);
            if (!exists) {
              source.push(invocation);
              if (invocation.input) state.all.push(invocation);
              continue;
            }
            // merge safely with existing invocation
            // invocations from server could be partial
            if (exists && !exists.report) {
              if (invocation.end) exists.end = invocation.end;
              if (invocation.input) exists.input = invocation.input;
              if (invocation.output) exists.output = invocation.output;
              if (invocation.errors) {
                exists.errors.push(...invocation.errors);
                exists.errors = uniqueBy(invocation.errors, (e) => e.id);
              }
              if (invocation.report) exists.report = invocation.report;
              if (invocation.start) exists.start = invocation.start;
              if (invocation.end) exists.end = invocation.end;
              if (invocation.logs) {
                exists.logs.push(...invocation.logs);
                exists.logs = pipe(
                  invocation.logs,
                  uniqueBy((e) => e.id),
                  sortBy((e) => e.timestamp),
                );
              }
            }
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
            (i) => i.source === data.functionID,
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
            (i) => i.source === data.functionID,
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
            (i) => i.source === data.functionID,
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
      forSource(source: string) {
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
