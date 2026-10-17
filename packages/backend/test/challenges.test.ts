import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import DynamoDB from "aws-sdk/clients/dynamodb";
import { issuer } from "@openauthjs/openauth";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import {
  dynamoChallenges,
  issuancePolicy,
} from "../src/function/auth/challenges";
import { singleUseCode, type Challenge } from "../src/function/auth/code";

// Opt-in integration tests execute real DynamoDB conditional expressions and
// transactions, not an in-memory imitation. Only a local endpoint is allowed.
const endpoint = process.env.AUTH_TEST_DYNAMO_ENDPOINT;
if (endpoint && new URL(endpoint).hostname !== "127.0.0.1")
  throw new Error("Local DynamoDB required");
const integration = endpoint ? describe : describe.skip;
integration("DynamoDB issuer boundary", () => {
  const options = {
    endpoint,
    region: "us-east-1",
    accessKeyId: "local",
    secretAccessKey: "local",
    maxRetries: 0,
  };
  const dynamo = new DynamoDB(options);
  const table = "auth-test-" + crypto.randomUUID();
  let time = 7200;
  const policy = issuancePolicy.parse({});
  const store = (overrides = {}) =>
    dynamoChallenges(
      new DynamoDB(options),
      () => table,
      { ...policy, ...overrides },
      () => time,
    );
  const challenge = (overrides: Partial<Challenge> = {}): Challenge => ({
    email: crypto.randomUUID() + "@example.com",
    impersonate: "",
    flowID: crypto.randomUUID(),
    challengeID: crypto.randomUUID(),
    authorization: "a".repeat(64),
    ...overrides,
  });
  // Retry a definite transaction conflict with the SAME command/idempotency ID.
  // Production can return 503 instead; a conflict never permits a send.
  async function issue(c: Challenge, overrides = {}) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await store(overrides).issue(c);
      } catch (error) {
        if (
          attempt === 30 ||
          !(error instanceof Error) ||
          error.name !== "TransactionCanceledException"
        )
          throw error;
        await Bun.sleep(10 + attempt * 5);
      }
    }
  }
  beforeAll(async () => {
    await dynamo
      .createTable({
        TableName: table,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
      })
      .promise();
  });
  afterAll(async () => {
    await dynamo.deleteTable({ TableName: table }).promise();
  });

  test("fresh flows and independent clients share the email cooldown atomically", async () => {
    time = 7200;
    const email = challenge().email;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => issue(challenge({ email }))),
    );
    expect(results.filter(Boolean).length).toBe(1);
    time += 59;
    expect(await issue(challenge({ email }))).toBe(false);
    time++;
    expect(await issue(challenge({ email }))).toBe(true);
  });

  test("email hourly limit includes new flows, resends and consumed challenges", async () => {
    time = 10800;
    const original = challenge();
    for (let n = 0; n < policy.emailHourly; n++) {
      const c = { ...original, challengeID: crypto.randomUUID() };
      expect(await issue(c)).toBe(true);
      expect(await store().consume(c)).toBe(true);
      time += 60;
    }
    expect(await issue(challenge({ email: original.email }))).toBe(false);
    time = 14400;
    expect(await issue(challenge({ email: original.email }))).toBe(true);
  });

  test("global minute budget holds across different emails and instances", async () => {
    time = 18000;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => issue(challenge(), { globalMinute: 3 })),
    );
    expect(results.filter(Boolean).length).toBe(3);
    expect(await issue(challenge(), { globalMinute: 3 })).toBe(false);
    time += 60;
    expect(await issue(challenge(), { globalMinute: 3 })).toBe(true);
  });

  test("global hourly budget cannot be bypassed by changing minute or email", async () => {
    time = 21600;
    for (let n = 0; n < 3; n++) {
      expect(await issue(challenge(), { globalHourly: 3 })).toBe(true);
      time += 60;
    }
    expect(await issue(challenge(), { globalHourly: 3 })).toBe(false);
    time = 25200;
    expect(await issue(challenge(), { globalHourly: 3 })).toBe(true);
  });

  test("denied transactions neither charge other budgets nor replace the active code", async () => {
    time = 28800;
    const c = challenge();
    expect(await issue(c, { globalMinute: 1 })).toBe(true);
    expect(
      await issue(challenge({ email: c.email }), { globalMinute: 1 }),
    ).toBe(false);
    const other = challenge();
    expect(await issue(other, { globalMinute: 1 })).toBe(false);
    expect(await store().consume(c)).toBe(true);
    time += 60;
    // Failed global reservation must not have consumed the other email's hour.
    expect(
      await issue(
        { ...other, challengeID: crypto.randomUUID() },
        { emailHourly: 1 },
      ),
    ).toBe(true);
  });

  test("resend/new challenge atomically supersedes old metadata; consume is single-use under races", async () => {
    time = 32400;
    const old = challenge();
    expect(await issue(old)).toBe(true);
    time += 60;
    const next = { ...old, challengeID: crypto.randomUUID() };
    expect(await issue(next)).toBe(true);
    expect(await store().consume(old)).toBe(false);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store().consume(next)),
    );
    expect(results.filter(Boolean).length).toBe(1);
  });

  test("email, flow, impersonation, authorization and ID must match server metadata", async () => {
    time = 36000;
    const c = challenge({ impersonate: "workspace-a" });
    expect(await issue(c)).toBe(true);
    for (const fields of [
      { email: "other@example.com" },
      { flowID: crypto.randomUUID() },
      { impersonate: "workspace-b" },
      { authorization: "b".repeat(64) },
      { challengeID: crypto.randomUUID() },
    ])
      expect(await store().consume({ ...c, ...fields })).toBe(false);
    expect(await store().consume(c)).toBe(true);
  });

  test("expired records fail closed even before DynamoDB TTL cleanup", async () => {
    time = 39600;
    const c = challenge();
    expect(await issue(c)).toBe(true);
    time += 600;
    expect(await store().consume(c)).toBe(false);
  });

  test("separate browser flows do not invalidate each other", async () => {
    time = 43200;
    const first = challenge();
    expect(await issue(first)).toBe(true);
    time += 60;
    const second = challenge({ email: first.email });
    expect(await issue(second)).toBe(true);
    expect(await store().consume(first)).toBe(true);
    expect(await store().consume(second)).toBe(true);
    const rows = await dynamo.scan({ TableName: table }).promise();
    expect(rows.Items?.some((row) => "code" in row || "token" in row)).toBe(
      false,
    );
  });

  test("HTTP issuance normalizes emails and reserves the shared budget before sending", async () => {
    time = 46800;
    let sends = 0;
    let successes = 0;
    let code = "";
    const email = "normalized@example.com";
    const app = issuer({
      storage: MemoryStorage(),
      async allow() {
        return true;
      },
      providers: {
        email: singleUseCode(
          {
            async request() {
              return new Response(null, { status: 302 });
            },
            async sendCode(claims, value) {
              expect(claims.email === email).toBe(true);
              expect(/^\d{6}$/.test(value)).toBe(true);
              sends++;
              code = value;
            },
          },
          store(),
        ),
      },
      async success() {
        successes++;
        return new Response("success");
      },
    });
    const authorization = await app.request(
      "https://auth.example/authorize?client_id=console&redirect_uri=https://app.example/callback&response_type=code&provider=email&state=local-test",
    );
    const authorizationCookie = authorization.headers
      .getSetCookie()
      .find((c) => c.startsWith("authorization="))!
      .split(";")[0]!;
    const post = (form: Record<string, string>, cookie = "") =>
      app.request("https://auth.example/email/authorize", {
        method: "POST",
        headers: { Cookie: `${cookie}; ${authorizationCookie}` },
        body: new URLSearchParams(form),
      });
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        post({
          action: "request",
          email: n % 2 ? email : " Normalized@Example.com ",
        }),
      ),
    );
    expect(sends).toBe(1);
    expect(responses.filter((r) => r.status === 302).length).toBe(1);
    expect(responses.every((r) => [302, 429, 503].includes(r.status))).toBe(
      true,
    );
    const saved = responses
      .find((r) => r.status === 302)!
      .headers.get("set-cookie")!
      .split(";")[0]!;
    const oldCode = code;
    const limited = await post({ action: "resend", email }, saved);
    expect(limited.status).toBe(429);
    expect(sends).toBe(1);
    time += 60;
    const resend = await post({ action: "resend", email }, saved);
    expect(sends).toBe(2);
    await post({ action: "verify", code: oldCode }, saved);
    expect(successes).toBe(0);
    await post(
      { action: "verify", code },
      resend.headers.get("set-cookie")!.split(";")[0]!,
    );
    expect(successes).toBe(1);
  });
});
