import { createInitializedContext } from "@console/web/common/context";
import type { DummyMode } from "@console/backend/replicache/dummy/data";
import { useSearchParams } from "@solidjs/router";
import { useStorage } from "./account";

export const { use: useDummy, provider: DummyProvider } =
  createInitializedContext("dummy", () => {
    const storage = useStorage();
    const [search] = useSearchParams<{
      dummy: DummyMode;
    }>();
    storage.set("dummy", search.dummy || storage.value.dummy || "base");
    const splits = location.hostname.split(".");
    const isDummy = splits[0] === "dummy" && splits[1] === "localhost";

    const result = () =>
      isDummy ? (storage.value.dummy as DummyMode) : undefined;
    result.ready = true;
    if (isDummy) console.log("dummy mode", storage.value.dummy);
    return result;
  });

export const { use: useDummyConfig, provider: DummyConfigProvider } =
  createInitializedContext("dummyConfig", () => {
    const dummy = useDummy();
    const result = () =>
      dummy()
        ? {
          user: "me@example.com",
          local: {
            app: "my-sst-app",
            stage: "local",
          },
        }
        : undefined;
    result.ready = true;
    return result;
  });
