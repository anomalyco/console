import { createInitializedContext } from "@console/web/common/context";
import { createMemo } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { useAuth } from "./auth";

export const { use: useFlags, provider: FlagsProvider } =
  createInitializedContext("FlagsContext", () => {
    const auth = useAuth();
    const email = createMemo(() => auth.current.email);
    const [search] = useSearchParams();
    const internal = createMemo(
      () => email().endsWith("@sst.dev") || search.internal === "true",
    );
    const local = window.location.hostname.includes("localhost");

    return {
      ready: true,
      get zero() {
        return internal() || local;
      }
    };
  });
