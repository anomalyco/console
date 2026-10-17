import {
  CodeProvider,
  type CodeProviderConfig,
  type CodeProviderState,
} from "@openauthjs/openauth/provider/code";
import type { Provider } from "@openauthjs/openauth/provider/provider";

export const providerCookie =
  "provider=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

export function codeRedirect(path: "email" | "code", error?: string) {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${process.env.AUTH_FRONTEND_URL}/auth/${path}?${params}`,
      ...(error ? { "Set-Cookie": providerCookie } : {}),
    },
  });
}

// Consume before comparing the code: a saved cookie must not permit retries,
// including concurrent requests or replay after a successful verification.
export function singleUseCode(
  config: CodeProviderConfig,
  challenge: {
    create(id: string): Promise<void>;
    consume(id: string): Promise<boolean>;
  },
): Provider<{ claims: Record<string, string> }> {
  const provider = CodeProvider({
    ...config,
    async sendCode(claims, code) {
      const id = crypto.randomUUID();
      claims.challengeID = id;
      const error = await config.sendCode(claims, code);
      if (error) return error;
      await challenge.create(id);
    },
  });
  return {
    ...provider,
    init(routes, ctx) {
      routes.use("/authorize", async (c, next) => {
        if (c.req.method === "POST") {
          const form = await c.req.formData();
          if (form.get("action") === "verify") {
            const state = await ctx.get<CodeProviderState | undefined>(
              c,
              "provider",
            );
            if (
              state?.type !== "code" ||
              !state.claims.challengeID ||
              !(await challenge.consume(state.claims.challengeID))
            ) {
              return ctx.forward(c, codeRedirect("email", "invalid_code"));
            }
          }
        }
        await next();
      });
      provider.init(routes, ctx);
    },
  };
}
