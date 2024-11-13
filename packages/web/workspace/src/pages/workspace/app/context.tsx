import { useReplicache } from "$/providers/replicache";
import { createContext, useContext } from "solid-js";
import { useParams } from "@solidjs/router";
import { AppStore } from "$/data/app";

export const AppContext = createContext<ReturnType<typeof createAppContext>>();

export function createAppContext() {
  const params = useParams();
  const rep = useReplicache();
  const app = AppStore.all.watch(
    rep,
    () => [],
    (items) => items.find((app) => app.name === params.appName)
  );

  return {
    get ready() {
      return app.ready;
    },
    get app() {
      return app()!;
    },
  };
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("No app context");
  return context;
}
