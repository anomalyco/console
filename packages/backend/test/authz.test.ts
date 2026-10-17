import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { STSClient } from "@aws-sdk/client-sts";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { Database } from "bun:sqlite";
import { getTableName } from "drizzle-orm";
import { SQSClient } from "@aws-sdk/client-sqs";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { fake, published, tokens, undiciCalls } from "./preload";
import { useWorkspace, withActor } from "@console/core/actor";

const WORKSPACE_A = "workspaceaaaaaaaaaaaaaaa";
const WORKSPACE_B = "workspacebbbbbbbbbbbbbbb";
const USER_A = "useraaaaaaaaaaaaaaaaaaaa";
const USER_B = "userbbbbbbbbbbbbbbbbbbbb";
const ACTOR_A = {
  type: "user",
  properties: { userID: USER_A, workspaceID: WORKSPACE_A },
} as const;
const ACTOR_B = {
  type: "user",
  properties: { userID: USER_B, workspaceID: WORKSPACE_B },
} as const;

tokens.set("token-a", { accountID: "accounta", email: "a@example.com" });

const executed: { name: string; workspaceID: string }[] = [];
mock.module("../src/replicache/server", () => ({
  server: {
    execute: async (name: string) => {
      executed.push({ name, workspaceID: useWorkspace() });
    },
  },
}));

const githubConnects: { installationID: number; workspaceID: string }[] = [];
const githubSyncs: number[] = [];
mock.module("@console/core/git/github", () => ({
  Github: {
    connect: async (installationID: number) => {
      githubConnects.push({ installationID, workspaceID: useWorkspace() });
    },
    syncRepos: async (installationID: number) => {
      githubSyncs.push(installationID);
    },
    useClient: async () => {
      throw new Error("Unexpected external client resolution");
    },
    disconnectAll: async () => {},
    serializeOrg: (x: any) => x,
    serializeRepo: (x: any) => x,
  },
}));

const slackConnects: { token: string; workspaceID: string }[] = [];
const slack = {
  connect: async (token: string) => {
    slackConnects.push({ token, workspaceID: useWorkspace() });
  },
  disconnect: async () => {},
  send: async () => {},
};
mock.module("@console/core/slack/index", () => ({ Slack: slack, ...slack }));

const fetches: string[] = [];
const realFetch = globalThis.fetch;

const { Hono } = await import("hono");
const { auth } = await import("../src/api/auth");
const { ReplicacheRoute, TABLES } = await import("../src/api/replicache");
const { LogRoute } = await import("../src/api/log");
const { AWS } = await import("@console/core/aws/index");
const { Stage } = await import("@console/core/app/stage");
const { Issue } = await import("@console/core/issue/index");
const { GithubRoute } = await import("../src/api/github");
const { SlackRoute } = await import("../src/api/slack");
const { IngestRoute } = await import("../src/api/ingest");
const { HTTPException } = await import("hono/http-exception");
const { User } = await import("@console/core/user/index");
const connect = await import("../src/function/connect");
const { codebuildHandler } = await import(
  "../src/function/events/runner-updated-external"
);

const app = new Hono()
  .use(auth)
  .onError((error, c) => {
    if (error instanceof HTTPException)
      return c.text(error.message, error.status);
    return c.text(String(error), 500);
  })
  .route("/replicache", ReplicacheRoute)
  .route("/github", GithubRoute)
  .route("/slack", SlackRoute)
  .route("/log", LogRoute)
  .route("/ingest", IngestRoute);

// Membership row returned by User.fromEmail for user A in workspace A.
const memberA = {
  id: USER_A,
  workspaceID: WORKSPACE_A,
  email: "a@example.com",
  timeDeleted: null,
};

function asUserA(init: RequestInit = {}) {
  fake.selects.push([memberA]);
  return {
    ...init,
    headers: {
      authorization: "Bearer token-a",
      "x-sst-workspace": WORKSPACE_A,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  };
}

function push(clientGroupID: string, clientID = "clienta") {
  return asUserA({
    method: "POST",
    body: JSON.stringify({
      pushVersion: 1,
      clientGroupID,
      profileID: "p",
      schemaVersion: "",
      mutations: [
        {
          clientID,
          id: 1,
          name: "app_create",
          args: {},
          timestamp: 0,
        },
      ],
    }),
  });
}

beforeEach(() => {
  fake.reset();
  executed.length = 0;
  githubConnects.length = 0;
  githubSyncs.length = 0;
  slackConnects.length = 0;
  published.length = 0;
  undiciCalls.length = 0;
  fetches.length = 0;
  globalThis.fetch = (async (input: any) => {
    fetches.push(String(input));
    if (String(input).startsWith("https://slack.com/"))
      return new Response(JSON.stringify({ access_token: "xoxb-attacker" }));
    return new Response("<Account>111111111111</Account>");
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("auth middleware", () => {
  test("rejects a workspace header for a workspace the account is not a member of", async () => {
    fake.selects.push([]);
    const res = await app.request("/replicache/push1", {
      method: "POST",
      headers: {
        authorization: "Bearer token-a",
        "x-sst-workspace": WORKSPACE_B,
      },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});

describe("replicache push", () => {
  test("rejects pushing into a client group owned by another workspace", async () => {
    const req = push("groupb");
    fake.selects.push(
      [{ id: "groupb", actor: ACTOR_B, cvrVersion: 0, clientVersion: 3 }],
      [],
    );
    const res = await app.request("/replicache/push1", req);
    expect(res.status).toBe(403);
    expect(executed).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  test("rejects moving another group's client into the caller's group", async () => {
    const req = push("groupa", "clientb");
    fake.selects.push(
      [{ id: "groupa", actor: ACTOR_A, cvrVersion: 0, clientVersion: 0 }],
      [
        {
          id: "clientb",
          clientGroupID: "groupb",
          mutationID: 0,
          clientVersion: 0,
        },
      ],
    );
    const res = await app.request("/replicache/push1", req);
    expect(res.status).toBe(403);
    expect(executed).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  test("rejects an empty client group id", async () => {
    const req = push("");
    const res = await app.request("/replicache/push1", req);
    expect(res.status).toBe(400);
    expect(executed).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  test("rejects a malformed client id", async () => {
    const req = push("groupa", "");
    const res = await app.request("/replicache/push1", req);
    expect(res.status).toBe(400);
    expect(executed).toEqual([]);
  });

  test("still accepts a push into the caller's own new group", async () => {
    const req = push("groupa");
    fake.selects.push([], []);
    const res = await app.request("/replicache/push1", req);
    expect(res.status).toBe(200);
    expect(executed).toEqual([
      { name: "app_create", workspaceID: WORKSPACE_A },
    ]);
  });
});

describe("replicache pull", () => {
  test("pull patches contain only public Slack metadata", async () => {
    const req = asUserA({
      method: "POST",
      body: JSON.stringify({
        pullVersion: 1,
        clientGroupID: "groupa",
        cookie: 0,
        profileID: "p",
        schemaVersion: "",
      }),
    });
    fake.selects.push(
      [{ id: "groupa", actor: ACTOR_A, cvrVersion: 0, clientVersion: 0 }],
      [],
      [],
      [],
      [],
    );
    for (const name of Object.keys(TABLES)) {
      fake.selects.push(
        name === "slackTeam"
          ? [{ id: "team1", version: "2026-01-01", key: "/slackTeam/team1" }]
          : [],
      );
    }
    fake.selects.push(
      [
        {
          id: "team1",
          workspaceID: WORKSPACE_A,
          teamID: "T1",
          teamName: "Example",
          timeCreated: "2026-01-01",
          timeUpdated: "2026-01-01",
          timeDeleted: null,
          accessToken: "test-only-slack-credential",
          futurePrivateField: "private",
        },
      ],
      [],
    );
    const res = await app.request("/replicache/pull1", req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const team = body.patch.find((x: any) => x.key === "/slackTeam/team1");
    expect(team.value).toMatchObject({
      id: "team1",
      teamID: "T1",
      teamName: "Example",
    });
    expect(team.value).not.toHaveProperty("accessToken");
    expect(team.value).not.toHaveProperty("futurePrivateField");
    expect(JSON.stringify(body.patch)).not.toContain(
      "test-only-slack-credential",
    );
    const selected = fake.queries.find((q) => q.columns?.teamName);
    expect(Object.keys(selected!.columns)).not.toContain("accessToken");
  });
  test("rejects an empty client group id", async () => {
    const req = asUserA({
      method: "POST",
      body: JSON.stringify({
        pullVersion: 1,
        clientGroupID: "",
        cookie: 0,
        profileID: "p",
        schemaVersion: "",
      }),
    });
    const res = await app.request("/replicache/pull1", req);
    expect(res.status).toBe(400);
    expect(fake.writes).toEqual([]);
  });
});

describe("github install", () => {
  test("callback ignores a raw workspace id in state", async () => {
    const res = await app.request(
      `/github/installed?state=${WORKSPACE_B}&installation_id=123`,
    );
    expect(res.status).toBe(401);
    expect(githubConnects).toEqual([]);
  });

  test("connect requires a workspace member", async () => {
    const res = await app.request(`/github/connect?workspaceID=${WORKSPACE_B}`);
    expect(res.status).toBe(401);
  });

  test("connect state only binds the caller's workspace", async () => {
    const req = asUserA();
    const res = await app.request("/github/connect", req);
    expect(res.status).toBe(302);
    const state = new URL(res.headers.get("location")!).searchParams.get(
      "state",
    )!;
    const callback = await app.request(
      `/github/installed?state=${encodeURIComponent(state)}&installation_id=123`,
    );
    expect(callback.status).toBe(200);
    expect(githubConnects).toEqual([
      { installationID: 123, workspaceID: WORKSPACE_A },
    ]);
  });
});

describe("slack oauth", () => {
  test("callback ignores a workspace id cookie set by the client", async () => {
    const res = await app.request("/slack/callback?code=c&state=abc", {
      headers: { cookie: `state=abc; workspaceID=${WORKSPACE_B}` },
    });
    expect(res.status).toBe(400);
    expect(slackConnects).toEqual([]);
  });

  test("callback connects the workspace that started the flow", async () => {
    const req = asUserA();
    const authorize = await app.request("/slack/authorize", req);
    expect(authorize.status).toBe(302);
    const state = new URL(authorize.headers.get("location")!).searchParams.get(
      "state",
    )!;
    const cookie = authorize.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
    fake.selects.push([{ id: USER_A }]);
    const res = await app.request(
      `/slack/callback?code=c&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `${cookie}; workspaceID=${WORKSPACE_B}` } },
    );
    expect(res.status).toBe(200);
    expect(slackConnects).toEqual([
      { token: "xoxb-attacker", workspaceID: WORKSPACE_A },
    ]);
  });
});

describe("user invite", () => {
  test("rejects a non-email address", async () => {
    await expect(
      (async () =>
        withActor(ACTOR_A, () => User.create({ email: "471890" })))(),
    ).rejects.toThrow();
    expect(fake.writes).toEqual([]);
  });

  test("accepts a valid email", async () => {
    fake.selects.push([{ id: "newuser" }]);
    const id = await withActor(ACTOR_A, () =>
      User.create({ email: "New@Example.com" }),
    );
    expect(id).toBe("newuser");
    expect(fake.writes[0]?.values).toMatchObject({
      email: "new@example.com",
      workspaceID: WORKSPACE_A,
    });
  });
});

describe("ingest", () => {
  const sendSQS = SQSClient.prototype.send;
  let fixture: Database;
  beforeEach(() => {
    SQSClient.prototype.send = (async () => ({})) as any;
    fixture = new Database(":memory:");
    fixture.exec(`
      CREATE TABLE workspace (id TEXT, time_deleted TEXT);
      CREATE TABLE aws_account (id TEXT, workspace_id TEXT, account_id TEXT, time_failed TEXT, time_deleted TEXT);
      CREATE TABLE app (id TEXT, workspace_id TEXT, name TEXT, time_deleted TEXT);
      CREATE TABLE stage (id TEXT, workspace_id TEXT, app_id TEXT, aws_account_id TEXT, name TEXT, region TEXT, time_deleted TEXT);
    `);
    fixture.run("INSERT INTO workspace VALUES (?, NULL)", [WORKSPACE_A]);
    fixture.run(
      "INSERT INTO aws_account VALUES ('account-a', ?, '111111111111', NULL, NULL), ('account-b', ?, '222222222222', NULL, NULL)",
      [WORKSPACE_A, WORKSPACE_A],
    );
    fixture.run("INSERT INTO app VALUES ('app-a', ?, 'app', NULL)", [
      WORKSPACE_A,
    ]);
    fixture.run(
      "INSERT INTO stage VALUES ('stage-a', ?, 'app-a', 'account-a', 'production', 'us-east-1', NULL)",
      [WORKSPACE_A],
    );
    // Evaluate the real Drizzle predicates/joins against fixture records rather
    // than letting a queued fake result hide a missing account/region guard.
    fake.resolveSelect = (query) => {
      const dialect = new MySqlDialect();
      let sql =
        "SELECT aws_account.account_id AS accountID, aws_account.workspace_id AS workspaceID, app.id AS appID, stage.id AS stageID FROM aws_account";
      const params: any[] = [];
      for (const call of query.calls) {
        if (["innerJoin", "leftJoin"].includes(call.method)) {
          const compiled = dialect.sqlToQuery(call.args[1]);
          sql += ` ${call.method === "innerJoin" ? "INNER" : "LEFT"} JOIN ${getTableName(call.args[0])} ON ${compiled.sql}`;
          params.push(...compiled.params);
        }
        if (call.method === "where") {
          const compiled = dialect.sqlToQuery(call.args[0]);
          sql += ` WHERE ${compiled.sql}`;
          params.push(...compiled.params);
        }
      }
      return fixture.query(sql).all(...params);
    };
    globalThis.fetch = (async () =>
      new Response(
        `<GetCallerIdentityResponse><Account>111111111111</Account><Arn>arn:aws:sts::111111111111:assumed-role/sst-console-issue-${WORKSPACE_A}-us-east-1/subscriber</Arn></GetCallerIdentityResponse>`,
      )) as unknown as typeof fetch;
  });
  afterEach(() => {
    fixture.close();
    SQSClient.prototype.send = sendSQS;
  });

  function ingest(overrides: any = {}) {
    return app.request("/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "aws.issue",
        properties: {
          identity:
            "https://sts.us-east-1.amazonaws.com/?Action=GetCallerIdentity",
          app: "app",
          stage: "production",
          region: "us-east-1",
          logGroup: "g",
          logStream: "s",
          issues: [
            {
              group: "g",
              timestamp: 1700000000000,
              err: {
                error: "Error",
                message: "message",
                stack: [],
                failed: true,
              },
            },
          ],
          ...overrides,
        },
      }),
    });
  }

  test("valid publisher maps to its real live account and stage", async () => {
    const res = await ingest();
    expect(res.status).toBe(200);
    expect(fake.writes.filter((x) => x.op === "insert").length).toBe(2);
    expect(fake.writes[0]!.values[0]).toMatchObject({
      workspaceID: WORKSPACE_A,
      stageID: "stage-a",
    });
  });

  test("same-workspace stage in a different AWS account is not an ingest target", async () => {
    fixture.run("UPDATE stage SET aws_account_id = 'account-b'");
    await ingest();
    expect(fake.writes).toEqual([]);
  });

  test("publisher deployment region may differ from the real stage region", async () => {
    globalThis.fetch = (async () =>
      new Response(
        `<Account>111111111111</Account><Arn>arn:aws:sts::111111111111:assumed-role/sst-console-issue-${WORKSPACE_A}-us-west-2/subscriber</Arn>`,
      )) as unknown as typeof fetch;
    const res = await ingest();
    expect(res.status).toBe(200);
    expect(fake.writes[0]!.values[0].stageID).toBe("stage-a");
  });

  test("stage region must match the publisher and requested region", async () => {
    fixture.run("UPDATE stage SET region = 'us-west-2'");
    await ingest();
    expect(fake.writes).toEqual([]);
  });

  test("composite IDs cannot map stages across tenants", async () => {
    fixture.run("UPDATE aws_account SET workspace_id = ?", [WORKSPACE_B]);
    await ingest();
    expect(fake.writes).toEqual([]);
  });

  for (const table of ["workspace", "aws_account", "app", "stage"]) {
    test(`deleted ${table} does not receive issues`, async () => {
      fixture.exec(`UPDATE ${table} SET time_deleted = '2026-01-01'`);
      await ingest();
      expect(fake.writes).toEqual([]);
    });
  }

  test("other roles are not accepted as issue publishers", async () => {
    globalThis.fetch = (async () =>
      new Response(
        "<Account>111111111111</Account><Arn>arn:aws:sts::111111111111:assumed-role/other/subscriber</Arn>",
      )) as unknown as typeof fetch;
    const res = await ingest();
    expect(res.status).toBe(401);
    expect(fake.writes).toEqual([]);
  });

  test("a publisher from another workspace cannot address this workspace", async () => {
    globalThis.fetch = (async () =>
      new Response(
        `<Account>111111111111</Account><Arn>arn:aws:sts::111111111111:assumed-role/sst-console-issue-${WORKSPACE_B}-us-east-1/subscriber</Arn>`,
      )) as unknown as typeof fetch;
    await ingest();
    expect(fake.writes).toEqual([]);
  });

  test("malformed parsed errors are rejected before identity lookup", async () => {
    const res = await ingest({
      issues: [{ group: "g", timestamp: 1, err: { stack: "not-an-array" } }],
    });
    expect(res.status).toBe(400);
    expect(fake.writes).toEqual([]);
  });

  test("does not fetch identity urls outside sts", async () => {
    const res = await app.request("/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "aws.issue",
        properties: {
          identity: "https://example.com/identity",
          app: "app",
          stage: "stage",
          region: "us-east-1",
          logGroup: "g",
          logStream: "s",
          issues: [],
        },
      }),
    });
    expect(res.status).toBe(400);
    expect(fetches).toEqual([]);
  });
});

describe("log subscription records", () => {
  test("filter names cannot substitute another delivery account", async () => {
    await Issue.extract({
      owner: "222222222222",
      logGroup: "g",
      logStream: "s",
      logEvents: [],
      subscriptionFilters: ["sst#us-east-1#111111111111#app#production"],
    });
    expect(fake.queries).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  test("matching delivery accounts use real account and region stage joins", async () => {
    await Issue.extract({
      owner: "111111111111",
      logGroup: "g",
      logStream: "s",
      logEvents: [],
      subscriptionFilters: ["sst#us-east-1#111111111111#app#production"],
    });
    const statements = querySQL(fake.queries[0]!);
    const stage = statements.find((x) =>
      x.sql.includes("`stage`.`aws_account_id`"),
    )!;
    expect(stage.sql).toContain(
      "`stage`.`aws_account_id` = `aws_account`.`id`",
    );
    expect(stage.params).toContain("us-east-1");
    expect(fake.writes).toEqual([]);
  });
});

describe("connect custom resource", () => {
  const sendSTS = STSClient.prototype.send;
  const sendCF = CloudFormationClient.prototype.send;
  let resourceStatus = "CREATE_COMPLETE";

  beforeEach(() => {
    resourceStatus = "CREATE_COMPLETE";
    STSClient.prototype.send = (async () => ({
      Credentials: {
        AccessKeyId: "a",
        SecretAccessKey: "s",
        SessionToken: "t",
      },
    })) as any;
    CloudFormationClient.prototype.send = (async () => ({
      StackResourceDetail: {
        ResourceType: "Custom::SSTConnect",
        ResourceStatus: resourceStatus,
      },
    })) as any;
  });

  afterEach(() => {
    STSClient.prototype.send = sendSTS;
    CloudFormationClient.prototype.send = sendCF;
  });

  function event(type: "Create" | "Delete", overrides: any = {}) {
    return {
      RequestType: type,
      ServiceToken: "x",
      ResponseURL:
        "https://cloudformation-custom-resource-response-useast1.s3.amazonaws.com/x",
      StackId:
        "arn:aws:cloudformation:us-east-1:111111111111:stack/SSTConsole/abc",
      RequestId: "r",
      LogicalResourceId: "SSTConnect",
      ResourceType: "Custom::SSTConnect",
      PhysicalResourceId: "none",
      ResourceProperties: {
        ServiceToken: "x",
        accountID: "111111111111",
        workspaceID: WORKSPACE_B,
        region: "us-east-1",
        role: "r",
      },
      ...overrides,
    } as any;
  }

  test("direct delete invocation does not disconnect an account", async () => {
    fake.selects.push(
      [{ id: "awsaccountb", accountID: "111111111111" }],
      [{ id: "awsaccountb" }],
    );
    await connect.handler(event("Delete"));
    expect(published).toEqual([]);
  });

  test("delete during stack deletion disconnects the account", async () => {
    resourceStatus = "DELETE_IN_PROGRESS";
    fake.selects.push(
      [{ id: "awsaccountb", accountID: "111111111111" }],
      [{ id: "awsaccountb" }],
    );
    await connect.handler(event("Delete"));
    expect(published.map((x) => x.type)).toEqual(["aws.account.removed"]);
  });

  test("does not send responses to arbitrary urls", async () => {
    await connect.handler(
      event("Create", { ResponseURL: "https://example.com/callback" }),
    );
    expect(undiciCalls).toEqual([]);
  });

  test("create can verify a live workspace before an account row exists", async () => {
    resourceStatus = "CREATE_IN_PROGRESS";
    fake.selects.push([{ id: WORKSPACE_B }], [{ id: "newaccount" }]);
    await connect.handler(event("Create"));
    expect(published.map((x) => x.type)).toContain("aws.account.created");
  });
});

function querySQL(query: (typeof fake.queries)[number]) {
  const dialect = new MySqlDialect();
  return query.calls
    .filter((x) => ["where", "innerJoin", "leftJoin"].includes(x.method))
    .map((x) => dialect.sqlToQuery(x.args[x.method === "where" ? 0 : 1]));
}

describe("AWS account resolution", () => {
  const sendSTS = STSClient.prototype.send;
  const sendLogs = CloudWatchLogsClient.prototype.send;
  let calls = 0;
  beforeEach(() => {
    calls = 0;
    STSClient.prototype.send = (async () => {
      calls++;
      return {
        Credentials: {
          AccessKeyId: "test-key",
          SecretAccessKey: "test-secret",
          SessionToken: "test-session",
        },
      };
    }) as any;
    CloudWatchLogsClient.prototype.send = (async () => ({ events: [] })) as any;
  });
  afterEach(() => {
    STSClient.prototype.send = sendSTS;
    CloudWatchLogsClient.prototype.send = sendLogs;
  });

  test("malformed account IDs never reach STS", async () => {
    const res = await app.request(
      "/log/aws/scan?awsAccountExternalID=other&region=us-east-1&logGroup=g&logStream=s",
      asUserA(),
    );
    expect(res.status).toBe(400);
    expect(calls).toBe(0);
  });

  test("missing, disconnected, foreign or deleted-workspace accounts never reach STS", async () => {
    const res = await app.request(
      "/log/aws/scan?awsAccountExternalID=111111111111&region=us-east-1&logGroup=g&logStream=s",
      asUserA(),
    );
    expect(res.status).toBe(404);
    expect(calls).toBe(0);
    const statements = querySQL(fake.queries[1]!);
    const where = statements.at(-1)!;
    expect(where.params).toEqual(["111111111111", WORKSPACE_A]);
    expect(where.sql).toContain("`aws_account`.`time_deleted` is null");
    expect(where.sql).toContain("`workspace`.`time_deleted` is null");
    expect(statements[0]!.sql).toContain(
      "`workspace`.`id` = `aws_account`.`workspace_id`",
    );
  });

  test("live connected accounts can still scan without logging credentials", async () => {
    const req = asUserA();
    fake.selects.push([{ id: "awsaccounta" }]);
    const entries: any[] = [];
    const log = console.log;
    console.log = (...args) => {
      entries.push(args);
    };
    try {
      const res = await app.request(
        "/log/aws/scan?awsAccountExternalID=111111111111&region=us-east-1&logGroup=g&logStream=s",
        req,
      );
      expect(res.status).toBe(200);
      expect(calls).toBe(1);
      expect(JSON.stringify(entries)).not.toContain("test-secret");
      expect(JSON.stringify(entries)).not.toContain("test-session");
    } finally {
      console.log = log;
    }
  });

  test("stage-based scans preserve account resolution", async () => {
    const req = asUserA();
    fake.selects.push(
      [
        {
          accountID: "111111111111",
          region: "us-east-1",
          name: "production",
          app: "app",
        },
      ],
      [{ id: "awsaccounta" }],
    );
    const res = await app.request(
      "/log/aws/scan?stageID=stageaaaaaaaaaaaaaaaaaaa&logGroup=g&logStream=s",
      req,
    );
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
  });

  test("account-only actors cannot assume workspace roles", async () => {
    await expect(
      withActor(
        {
          type: "account",
          properties: { accountID: "accounta", email: "a@example.com" },
        },
        () => AWS.assumeRole("111111111111"),
      ),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });

  test("normal users cannot use connect bootstrap", async () => {
    await expect(
      withActor(ACTOR_A, () => AWS.assumeRoleForConnect("111111111111")),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });

  test("connect bootstrap rejects a deleted or absent workspace before STS", async () => {
    await withActor(
      { type: "system", properties: { workspaceID: WORKSPACE_A } },
      () => AWS.assumeRoleForConnect("111111111111"),
    );
    expect(calls).toBe(0);
    expect(querySQL(fake.queries[0]!).at(-1)!.sql).toContain(
      "`workspace`.`time_deleted` is null",
    );
  });

  test("stage role resolution requires tenant-equal live resources", async () => {
    await withActor(ACTOR_A, () =>
      Stage.assumeRole("stageaaaaaaaaaaaaaaaaaaa"),
    );
    expect(calls).toBe(0);
    const statements = querySQL(fake.queries[0]!);
    expect(statements[0]!.sql).toContain(
      "`stage`.`workspace_id` = `aws_account`.`workspace_id`",
    );
    for (const table of ["stage", "app", "aws_account"]) {
      expect(statements.at(-1)!.sql).toContain(
        `\`${table}\`.\`time_deleted\` is null`,
      );
    }
  });
});

test("runner state diagnostics do not include environment payloads", async () => {
  const entries: any[] = [];
  const log = console.log;
  console.log = (...args) => {
    entries.push(args);
  };
  try {
    await codebuildHandler({
      account: "111111111111",
      region: "us-east-1",
      "detail-type": "CodeBuild Build State Change",
      detail: {
        "build-status": "FAILED",
        "project-name": "sst-runner-test",
        "additional-information": {
          environment: {
            "environment-variables": [
              {
                name: "SST_RUNNER_EVENT",
                value: JSON.stringify({
                  workspaceID: WORKSPACE_A,
                  runID: "runaaaaaaaaaaaaaaaaaaaaa",
                  env: { SECRET: "test-only-deploy-secret" },
                  repo: {
                    cloneUrl: "https://test-only-clone-token@example.com/repo",
                  },
                }),
              },
            ],
          },
        },
      },
    });
    expect(JSON.stringify(entries)).not.toContain("test-only-deploy-secret");
    expect(JSON.stringify(entries)).not.toContain("test-only-clone-token");
  } finally {
    console.log = log;
  }
});
