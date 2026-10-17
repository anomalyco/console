import { Hono } from "hono";
import { Resource } from "sst";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getCookie, setCookie } from "hono/cookie";
import { useWorkspace, withActor } from "@console/core/actor";
import { createId } from "@console/core/util/sql";
import { HTTPException } from "hono/http-exception";
import { Slack } from "@console/core/slack/index";
import { signState, verifyState } from "./state";

const STATE_PURPOSE = "slack-oauth";

export const SlackRoute = new Hono()
  .get("/authorize", async (c) => {
    const origin = c.req.header("x-forwarded-host") || c.req.header("host");
    const nonce = createId();
    const state = signState(Resource.SlackClientSecret.value, STATE_PURPOSE, {
      workspaceID: useWorkspace(),
      nonce,
    });
    const authorize = new URL("https://slack.com/oauth/v2/authorize");
    authorize.search = new URLSearchParams({
      client_id: Resource.SlackClientID.value,
      scope: "chat:write team:read chat:write.public",
      redirect_uri: `https://${origin}/slack/callback`,
      state,
    }).toString();
    setCookie(c, "state", nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 600,
    });
    return c.redirect(authorize.toString());
  })
  .get(
    "/callback",
    zValidator("query", z.object({ code: z.string(), state: z.string() })),
    async (c) => {
      const origin = c.req.header("x-forwarded-host") || c.req.header("host");
      const nonce = getCookie(c, "state");
      const query = c.req.valid("query");
      const state = verifyState(
        Resource.SlackClientSecret.value,
        STATE_PURPOSE,
        query.state,
      );
      if (!state || !nonce || state.nonce !== nonce) {
        throw new HTTPException(400, {
          message: "invalid state parameter",
        });
      }
      const workspaceID = state.workspaceID;
      const response = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: Resource.SlackClientID.value,
          client_secret: Resource.SlackClientSecret.value,
          code: query.code,
          redirect_uri: `https://${origin}/slack/callback`,
        }),
      });

      if (!response.ok)
        throw new HTTPException(401, {
          message: "Unauthorized",
        });
      const data = (await response.json()) as { access_token: string };
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID,
          },
        },
        async () => {
          await Slack.connect(data.access_token);
        },
      );
      return c.html(`
          <html>
            <script>
              if (window.opener) {
                window.opener.postMessage("slack.success", "*")
                window.close()
              }
            </script>
          </html>
      `);
    },
  );
