import { useNavigate } from "@solidjs/router";
import { createEffect } from "solid-js";
import { useAuth2 } from "../providers/auth2";
import { useLocalContext } from "../providers/local";
import { Splash } from "../ui/splash";

export function Local() {
  const ctx = useLocalContext();
  const nav = useNavigate();
  createEffect(async () => {
    const { app, stage } = ctx;
    if (!app || !stage) return;
    const auth = useAuth2();
    for (const account of auth.all) {
      const result = await fetch(
        import.meta.env.VITE_API_URL +
        "/local?" +
        new URLSearchParams({
          app,
          stage,
        }).toString(),
        {
          headers: {
            authorization: `Bearer ${account.token}`,
            "content-type": "application/json",
          },
        },
      ).then((res) => res.json());
      if (!result.length) continue;
      nav(`/${result[0]}/${app}/${stage}`);
    }
  });

  return <Splash pulse />;
}
