import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { STSClient } from "@aws-sdk/client-sts";
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
const { ReplicacheRoute } = await import("../src/api/replicache");
const { GithubRoute } = await import("../src/api/github");
const { SlackRoute } = await import("../src/api/slack");
const { IngestRoute } = await import("../src/api/ingest");
const { HTTPException } = await import("hono/http-exception");
const { User } = await import("@console/core/user/index");
const connect = await import("../src/function/connect");

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
    fake.selects.push([{ id: "awsaccountb", accountID: "111111111111" }]);
    await connect.handler(event("Delete"));
    expect(published).toEqual([]);
  });

  test("delete during stack deletion disconnects the account", async () => {
    resourceStatus = "DELETE_IN_PROGRESS";
    fake.selects.push([{ id: "awsaccountb", accountID: "111111111111" }]);
    await connect.handler(event("Delete"));
    expect(published.map((x) => x.type)).toEqual(["aws.account.removed"]);
  });

  test("does not send responses to arbitrary urls", async () => {
    await connect.handler(
      event("Create", { ResponseURL: "https://example.com/callback" }),
    );
    expect(undiciCalls).toEqual([]);
  });
});
