import { expect, test } from "bun:test";
import { issuer } from "@openauthjs/openauth";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import {
  singleUseCode,
  codeRedirect,
  providerCookie,
  type Challenge,
} from "../src/function/auth/code";

function fixture(mailFailure = false) {
  const challenges = new Map<string, Challenge>();
  let permitted = true;
  let unavailable = false;
  let sends = 0;
  const scope = (c: Challenge) =>
    JSON.stringify([c.email, c.flowID, c.impersonate]);
  let code = "";
  let successes = 0;
  const app = issuer({
    storage: MemoryStorage(),
    async allow() {
      return true;
    },
    providers: {
      email: singleUseCode(
        {
          async sendCode(_, value) {
            sends++;
            code = value;
            if (mailFailure)
              throw new Error("mail error containing private payload");
          },
          async request(_, state, __, error) {
            return codeRedirect(
              error || state.type === "start" ? "email" : "code",
              error?.type,
            );
          },
        },
        {
          async issue(c) {
            if (unavailable) throw new Error("storage unavailable");
            if (!permitted) return false;
            challenges.set(scope(c), { ...c });
            return true;
          },
          async consume(c) {
            if (unavailable) throw new Error("storage unavailable");
            const saved = challenges.get(scope(c));
            if (
              !saved ||
              saved.challengeID !== c.challengeID ||
              saved.authorization !== c.authorization
            )
              return false;
            return challenges.delete(scope(c));
          },
        },
      ),
    },
    async success() {
      successes++;
      return new Response("success");
    },
  });
  const authorize = (state: string) =>
    app.request(
      `https://auth.example/authorize?client_id=console&redirect_uri=https://app.example/callback&response_type=code&provider=email&state=${state}`,
    );
  const defaultAuthorization = Promise.resolve(
    authorize(crypto.randomUUID()),
  ).then(
    (r) =>
      r.headers
        .getSetCookie()
        .find((c) => c.startsWith("authorization="))!
        .split(";")[0]!,
  );
  const post = async (form: Record<string, string>, cookie = "") =>
    app.request("https://auth.example/email/authorize", {
      method: "POST",
      headers: {
        Cookie: [
          cookie,
          cookie.includes("authorization=") ? "" : await defaultAuthorization,
        ]
          .filter(Boolean)
          .join("; "),
      },
      body: new URLSearchParams(form),
    });
  return {
    post,
    code: () => code,
    successes: () => successes,
    sends: () => sends,
    limit: () => {
      permitted = false;
    },
    fail: () => {
      unavailable = true;
    },
    challenges,
    authorize,
    unbound: (form: Record<string, string>, cookie = "") =>
      app.request("https://auth.example/email/authorize", {
        method: "POST",
        headers: { Cookie: cookie },
        body: new URLSearchParams(form),
      }),
  };
}

test("wrong code clears cookie and consumes saved challenge", async () => {
  const f = fixture();
  const start = await f.post({ action: "request", email: "test@example.com" });
  const saved = start.headers.get("set-cookie")!.split(";")[0];
  const wrong = await f.post({ action: "verify", code: "wrong" }, saved);
  expect(wrong.headers.get("set-cookie")).toBe(providerCookie);
  expect(wrong.headers.get("location")).toContain(
    "/auth/email?error=invalid_code",
  );
  const replay = await f.post({ action: "verify", code: f.code() }, saved);
  expect(replay.headers.get("set-cookie")).toBe(providerCookie);
  const cleared = await f.post({ action: "verify", code: f.code() });
  expect(cleared.headers.get("location")).toContain("invalid_code");
  expect(f.successes()).toBe(0);
});

const cookie = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

test("fresh challenges cannot send mail once the server budget is exhausted", async () => {
  const f = fixture();
  f.limit();
  const responses = await Promise.all(
    Array.from({ length: 20 }, () =>
      f.post({
        action: "request",
        email: "test@example.com",
        flowID: crypto.randomUUID(),
      }),
    ),
  );
  expect(responses.every((r) => r.status === 429)).toBe(true);
  expect(f.sends()).toBe(0);
});

test("resend replaces the old challenge and the new code still signs in", async () => {
  const f = fixture();
  const start = await f.post({
    action: "request",
    email: " Test@Example.com ",
  });
  const saved = cookie(start);
  const old = f.code();
  const resend = await f.post(
    { action: "resend", email: "test@example.com" },
    saved,
  );
  expect(resend.status).toBe(302);
  await f.post({ action: "verify", code: old }, saved);
  expect(f.successes()).toBe(0);
  await f.post({ action: "verify", code: f.code() }, cookie(resend));
  expect(f.successes()).toBe(1);
  expect(f.challenges.size).toBe(0);
});

test("a new request in the same flow replaces the earlier code", async () => {
  const f = fixture();
  const saved = cookie(
    await f.post({ action: "request", email: "test@example.com" }),
  );
  const old = f.code();
  const next = await f.post(
    {
      action: "request",
      email: "test@example.com",
      challengeID: "forged",
      flowID: "forged",
    },
    saved,
  );
  await f.post({ action: "verify", code: old }, saved);
  expect(f.successes()).toBe(0);
  await f.post({ action: "verify", code: f.code() }, cookie(next));
  expect(f.successes()).toBe(1);
});

test("throttled resend preserves the outstanding legitimate code", async () => {
  const f = fixture();
  const saved = cookie(
    await f.post({ action: "request", email: "test@example.com" }),
  );
  f.limit();
  const result = await f.post(
    { action: "resend", email: "test@example.com" },
    saved,
  );
  expect(result.status).toBe(429);
  expect(result.headers.has("set-cookie")).toBe(false);
  await f.post({ action: "verify", code: f.code() }, saved);
  expect(f.successes()).toBe(1);
  expect(f.sends()).toBe(1);
});

test("independent browser flows for the same email remain usable", async () => {
  const f = fixture();
  const first = cookie(
    await f.post({ action: "request", email: "test@example.com" }),
  );
  const firstCode = f.code();
  const second = cookie(
    await f.post({ action: "request", email: "test@example.com" }),
  );
  await f.post({ action: "verify", code: firstCode }, first);
  await f.post({ action: "verify", code: f.code() }, second);
  expect(f.successes()).toBe(2);
});

test("resend cannot change the email or impersonation target", async () => {
  const f = fixture();
  const saved = cookie(
    await f.post({
      action: "request",
      email: "test@example.com",
      impersonate: "workspace-a",
    }),
  );
  for (const fields of [
    { email: "other@example.com", impersonate: "workspace-a" },
    { email: "test@example.com", impersonate: "workspace-b" },
  ]) {
    const result = await f.post({ action: "resend", ...fields }, saved);
    expect(result.headers.get("location")).toContain("invalid_code");
  }
  expect(f.sends()).toBe(1);
});

test("verification is bound to server-side authorization metadata", async () => {
  const f = fixture();
  const saved = cookie(
    await f.post({ action: "request", email: "test@example.com" }),
  );
  const challenge = [...f.challenges.values()][0]!;
  challenge.authorization = "f".repeat(64);
  await f.post({ action: "verify", code: f.code() }, saved);
  expect(f.successes()).toBe(0);
});

test("an authentic provider cookie cannot be transplanted into another OAuth flow", async () => {
  const f = fixture();
  const first = (await f.authorize("first")).headers
    .getSetCookie()
    .find((c) => c.startsWith("authorization="))!
    .split(";")[0]!;
  const second = (await f.authorize("second")).headers
    .getSetCookie()
    .find((c) => c.startsWith("authorization="))!
    .split(";")[0]!;
  const start = await f.post(
    { action: "request", email: "test@example.com" },
    first,
  );
  const provider = cookie(start);
  await f.post({ action: "verify", code: f.code() }, `${provider}; ${second}`);
  expect(f.successes()).toBe(0);
  // A mismatched flow must not consume the original legitimate challenge.
  await f.post({ action: "verify", code: f.code() }, `${provider}; ${first}`);
  expect(f.successes()).toBe(1);
});

test("storage failures fail closed before mail or authentication", async () => {
  const f = fixture();
  f.fail();
  expect(
    (await f.post({ action: "request", email: "test@example.com" })).status,
  ).toBe(503);
  expect(f.sends()).toBe(0);
  const g = fixture();
  const saved = cookie(
    await g.post({ action: "request", email: "test@example.com" }),
  );
  g.fail();
  expect(
    (await g.post({ action: "verify", code: g.code() }, saved)).status,
  ).toBe(503);
  expect(g.successes()).toBe(0);
});

test("mail errors do not leak provider payloads and do not create a usable cookie", async () => {
  const f = fixture(true);
  const response = await f.post({
    action: "request",
    email: "test@example.com",
  });
  expect(response.status).toBe(503);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect((await response.text()).includes("private payload")).toBe(false);
  expect(f.successes()).toBe(0);
});

test("concurrent guesses can only consume a challenge once", async () => {
  const f = fixture();
  const start = await f.post({ action: "request", email: "test@example.com" });
  const saved = start.headers.get("set-cookie")!.split(";")[0];
  await Promise.all(
    Array.from({ length: 20 }, () =>
      f.post({ action: "verify", code: f.code() }, saved),
    ),
  );
  expect(f.successes()).toBe(1);
});

test("verification without provider state fails closed", async () => {
  const f = fixture();
  const result = await f.post({ action: "verify", code: "123456" });
  expect(result.status).toBe(302);
  expect(result.headers.get("set-cookie")).toBe(providerCookie);
  expect(f.successes()).toBe(0);
});

test("issuance without authenticated OAuth flow state never sends mail", async () => {
  const f = fixture();
  const response = await f.unbound({
    action: "request",
    email: "test@example.com",
  });
  expect(response.headers.get("location")).toContain("invalid_code");
  expect(f.sends()).toBe(0);
  const forged = await f.unbound(
    { action: "request", email: "test@example.com" },
    "authorization=not-a-real-authorization",
  );
  expect(forged.headers.get("location")).toContain("invalid_code");
  expect(f.sends()).toBe(0);
});

test("separate encrypted OAuth sessions with identical decoded fields are not interchangeable", async () => {
  const f = fixture();
  const first = (await f.authorize("same")).headers
    .getSetCookie()
    .find((c) => c.startsWith("authorization="))!
    .split(";")[0]!;
  const second = (await f.authorize("same")).headers
    .getSetCookie()
    .find((c) => c.startsWith("authorization="))!
    .split(";")[0]!;
  const start = await f.post(
    { action: "request", email: "test@example.com" },
    first,
  );
  const provider = cookie(start);
  await f.post({ action: "verify", code: f.code() }, `${provider}; ${second}`);
  expect(f.successes()).toBe(0);
  await f.post({ action: "verify", code: f.code() }, `${provider}; ${first}`);
  expect(f.successes()).toBe(1);
});
