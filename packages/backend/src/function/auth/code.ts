import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { CodeProviderConfig } from "@openauthjs/openauth/provider/code";
import type { Provider } from "@openauthjs/openauth/provider/provider";
import { z } from "zod";

export const providerCookie =
  "provider=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
export const challengeLifetime = 600;
export const emailClaim = z.string().trim().toLowerCase().email().max(254);
const claimsSchema = z.object({
  email: emailClaim,
  impersonate: z.string().max(128).default(""),
});
export const bindingSchema = claimsSchema.extend({
  flowID: z.string().uuid(),
  authorization: z.string().length(64),
  challengeID: z.string().uuid(),
});
export type Challenge = z.infer<typeof bindingSchema>;
const stateSchema = z.object({
  type: z.literal("code"),
  code: z.string().regex(/^\d{6}$/),
  claims: bindingSchema,
});
export interface Challenges {
  issue(challenge: Challenge): Promise<boolean>;
  consume(challenge: Challenge): Promise<boolean>;
}
export type CodeAudit = (
  action: "request" | "resend" | "verify",
  result: "success" | "invalid" | "limited" | "unavailable",
  claims?: Pick<Challenge, "email" | "impersonate">,
) => void;

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

// Keep OpenAuth's encrypted provider state, but own issuance and consumption.
// No client-supplied flow/challenge fields are ever accepted as claims.
export function singleUseCode(
  config: CodeProviderConfig<Challenge>,
  challenges: Challenges,
  audit: CodeAudit = () => {},
): Provider<{ claims: Challenge }> {
  return {
    type: "code",
    init(routes, ctx) {
      routes.get("/authorize", async (c) => {
        await ctx.unset(c, "provider");
        return ctx.forward(
          c,
          await config.request(c.req.raw, { type: "start" }),
        );
      });
      routes.post("/authorize", async (c) => {
        const form = await c.req.formData();
        const action = form.get("action");
        if (action !== "request" && action !== "resend" && action !== "verify")
          return ctx.forward(c, codeRedirect("email", "invalid_claim"));
        const state = stateSchema.safeParse(await ctx.get(c, "provider"));
        const authorization = createHash("sha256")
          .update(JSON.stringify((await ctx.get(c, "authorization")) ?? null))
          .digest("hex");
        const invalid = () => {
          audit(
            action,
            "invalid",
            state.success ? state.data.claims : undefined,
          );
          return ctx.forward(c, codeRedirect("email", "invalid_code"));
        };
        if (action === "verify") {
          if (
            !state.success ||
            state.data.claims.authorization !== authorization
          )
            return invalid();
          try {
            // Consume BEFORE comparison, including wrong guesses.
            if (!(await challenges.consume(state.data.claims)))
              return invalid();
          } catch {
            audit(action, "unavailable", state.data.claims);
            return c.text("Authentication temporarily unavailable", 503);
          }
          const submitted = form.get("code");
          if (
            typeof submitted !== "string" ||
            !/^\d{6}$/.test(submitted) ||
            !timingSafeEqual(
              Buffer.from(state.data.code),
              Buffer.from(submitted),
            )
          )
            return invalid();
          await ctx.unset(c, "provider");
          audit(action, "success", state.data.claims);
          return ctx.forward(
            c,
            await ctx.success(c, { claims: state.data.claims }),
          );
        }
        const parsed = claimsSchema.safeParse({
          email: form.get("email"),
          impersonate: form.get("impersonate") ?? "",
        });
        if (!parsed.success) {
          audit(action, "invalid");
          return ctx.forward(c, codeRedirect("email", "invalid_claim"));
        }
        // A resend cannot retarget an existing flow.
        if (
          action === "resend" &&
          (!state.success ||
            state.data.claims.authorization !== authorization ||
            state.data.claims.email !== parsed.data.email ||
            state.data.claims.impersonate !== parsed.data.impersonate)
        )
          return invalid();
        const reuse =
          state.success &&
          state.data.claims.authorization === authorization &&
          state.data.claims.email === parsed.data.email &&
          state.data.claims.impersonate === parsed.data.impersonate;
        const claims: Challenge = {
          ...parsed.data,
          authorization,
          flowID: reuse ? state.data.claims.flowID : crypto.randomUUID(),
          challengeID: crypto.randomUUID(),
        };
        const code = String(randomInt(1_000_000)).padStart(6, "0");
        try {
          if (!(await challenges.issue(claims))) {
            audit(action, "limited", claims);
            // Do not discard the outstanding code/cookie on throttled resend.
            return c.text("Please wait before requesting another code", 429);
          }
          const error = await config.sendCode(claims, code);
          if (error) {
            await challenges.consume(claims);
            audit(action, "invalid", claims);
            return ctx.forward(c, codeRedirect("email", error.type));
          }
        } catch {
          // Mail/provider exceptions can contain the message/code; never log them.
          audit(action, "unavailable", claims);
          return c.text("Authentication temporarily unavailable", 503);
        }
        await ctx.set(c, "provider", challengeLifetime, {
          type: "code",
          code,
          claims,
        });
        audit(action, "success", claims);
        return ctx.forward(
          c,
          await config.request(
            c.req.raw,
            {
              type: "code",
              code,
              claims,
              resend: action === "resend",
            },
            form,
          ),
        );
      });
    },
  };
}
