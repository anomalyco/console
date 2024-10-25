import type { Invocation } from "@console/core/log";
import { pipe, sortBy, uniqueBy } from "remeda";
import { createStore, produce } from "solid-js/store";

export function createInvocationStore() {
  const [store, setStore] = createStore<Invocation[]>([]);

  return {
    ingest(invocations: Invocation[]) {
      setStore(
        produce((state) => {
          for (const invocation of invocations) {
            const exists = state.findLast((i) => i.id === invocation.id);
            if (!exists) {
              state.push(invocation);
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
    },
    get all() {
      return store;
    },
    clear() {
      setStore(produce((state) => state.splice(0)));
    },
  };
}
