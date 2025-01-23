import { createInitializedContext } from "@console/web/common/context";
import { createStore } from "solid-js/store";

export const { use: useReplicacheStatus, provider: ReplicacheStatusProvider } =
  createInitializedContext("ReplicacheStatusProvider", () => {
    const [store, setStore] = createStore<
      Record<
        string,
        {
          synced?: boolean;
        }
      >
    >();

    return {
      isSynced(id: string) {
        return Boolean(store[id]?.synced);
      },
      markSynced(id: string) {
        setStore(id, {
          synced: true,
        });
      },
      ready: true,
    };
  });
