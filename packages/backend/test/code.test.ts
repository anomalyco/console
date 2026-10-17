import { expect, test } from "bun:test";
import { issuer } from "@openauthjs/openauth";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import {
  singleUseCode,
  codeRedirect,
  providerCookie,
} from "../src/function/auth/code";

function fixture() {
  const challenges = new Set<string>();
  let code = "";
  let successes = 0;
  const app = issuer({
    storage: MemoryStorage(),
    providers: {
      email: singleUseCode(
        {
          async sendCode(_, value) {
            code = value;
          },
          async request(_, state, __, error) {
            return codeRedirect(
              error || state.type === "start" ? "email" : "code",
              error?.type,
            );
          },
        },
        {
          async create(id) {
            challenges.add(id);
          },
          async consume(id) {
            return challenges.delete(id);
          },
        },
      ),
    },
    async success() {
      successes++;
      return new Response("success");
    },
  });
  const post = (form: Record<string, string>, cookie = "") =>
    app.request("https://auth.example/email/authorize", {
      method: "POST",
      headers: { Cookie: cookie },
      body: new URLSearchParams(form),
    });
  return { post, code: () => code, successes: () => successes };
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
