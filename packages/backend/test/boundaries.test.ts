import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { getTableColumns, getTableName } from "drizzle-orm";
import { Hono } from "hono";
import { fake, tokens, published } from "./preload";
import { withActor, useActor } from "@console/core/actor";
import { account } from "@console/core/account/account.sql";
import { workspace } from "@console/core/workspace/workspace.sql";
import { user } from "@console/core/user/user.sql";
import { app, appRepoTable } from "@console/core/app/app.sql";
import { githubOrgTable, githubRepoTable } from "@console/core/git/git.sql";
import { AppRepo } from "@console/core/app/repo";
import { Github } from "@console/core/git/github";
import { Stage } from "@console/core/app/stage";
import { awsAccount } from "@console/core/aws/aws.sql";
import { runConfigTable, runTable } from "@console/core/run/run.sql";
import { RunConfig } from "@console/core/run/config";
import { Workspace } from "@console/core/workspace/index";
import { Run } from "@console/core/run/index";
import { auth } from "../src/api/auth";
import { SlackRoute } from "../src/api/slack";
import {
  handler as runner,
  codebuildHandler,
} from "../src/function/events/runner-updated-external";
import { handler as stack } from "../src/function/events/stack-updated-external";
import { handler as internal } from "../src/function/events/event";
import { internalActor } from "../src/function/events/authorization";
import { eventBusPolicy } from "../../../infra/event-policy";

const A = "workspaceaaaaaaaaaaaaaaa";
const B = "workspacebbbbbbbbbbbbbbb";
const APP = "appaaaaaaaaaaaaaaaaaaaaa";
const ID = "configaaaaaaaaaaaaaaaaaa";
const RUN = "runaaaaaaaaaaaaaaaaaaaaa";
const ACCOUNT = "accountaaaaaaaaaaaaaaaaa";
const actor = {
  type: "user",
  properties: { userID: "useraaaaaaaaaaaaaaaaaaaa", workspaceID: A },
} as const;
const accountActor = {
  type: "account",
  properties: { accountID: ACCOUNT, email: "a@example.com" },
} as const;
let database: Database;
const http = new Hono()
  .use(auth)
  .get("/", (c) => c.json(useActor()))
  .route("/slack", SlackRoute);

// Execute the actual Drizzle predicates against isolated rows. Only MySQL's
// insert syntax is adapted; authorization WHERE/JOIN clauses run unchanged.
beforeEach(() => {
  fake.reset();
  published.length = 0;
  database = new Database(":memory:");
  for (const table of [
    account,
    workspace,
    user,
    app,
    awsAccount,
    runConfigTable,
    runTable,
    appRepoTable,
    githubOrgTable,
    githubRepoTable,
  ]) {
    const columns = Object.values(getTableColumns(table)).map(
      (c) => `\`${c.name}\``,
    );
    const primary = columns.includes("`workspace_id`")
      ? "workspace_id, id"
      : "id";
    database.run(
      `CREATE TABLE \`${getTableName(table)}\` (${columns.join(", ")}, PRIMARY KEY (${primary}))`,
    );
  }
  database.run(
    "CREATE UNIQUE INDEX stage_pattern ON run_config(workspace_id, app_id, stage_pattern)",
  );
  fake.sql = drizzle(async (sql, params, method) => {
    sql = sql
      .replace(/insert ignore/i, "insert or ignore")
      .replace(/on duplicate key update/i, "on conflict do update set")
      .replace(/now\(\)/gi, "'2026-10-17 12:00:00'")
      .replace(/\bdefault\b/gi, "null");
    const statement = database.query(sql);
    if (method === "all") {
      // PlanetScale decodes JSON columns before returning them to Drizzle.
      const json = new Set(["env", "log", "trigger", "config", "retrier"]);
      const rows = statement
        .values(...params)
        .map((row) =>
          row.map((value, i) =>
            json.has(statement.columnNames[i]!) && typeof value === "string"
              ? JSON.parse(value)
              : value,
          ),
        );
      return { rows };
    }
    const result = statement.run(...params);
    return {
      rows: [
        { insertId: result.lastInsertRowid, affectedRows: result.changes },
      ],
    };
  });
  database.run("INSERT INTO account (id, email) VALUES (?, ?)", [
    ACCOUNT,
    "a@example.com",
  ]);
  for (const id of [A, B]) {
    database.run("INSERT INTO workspace (id, slug) VALUES (?, ?)", [id, id]);
    database.run(
      "INSERT INTO app (workspace_id, id, name) VALUES (?, ?, 'app')",
      [id, APP],
    );
    database.run(
      "INSERT INTO aws_account (workspace_id, id, account_id) VALUES (?, 'awsaccount', ?)",
      [id, id === A ? "111111111111" : "222222222222"],
    );
  }
  database.run("INSERT INTO user (workspace_id, id, email) VALUES (?, ?, ?)", [
    A,
    actor.properties.userID,
    "a@example.com",
  ]);
  tokens.set("boundary-token", accountActor.properties);
});

describe("repository ownership", () => {
  const repoID = "repoaaaaaaaaaaaaaaaaaaaa";
  const orgID = "orgaaaaaaaaaaaaaaaaaaaaa";
  function seedRepo(workspaceID: string) {
    database.run(
      "INSERT INTO github_organization (workspace_id, id) VALUES (?, ?)",
      [workspaceID, orgID],
    );
    database.run(
      "INSERT INTO github_repository (workspace_id, id, github_org_id) VALUES (?, ?, ?)",
      [workspaceID, repoID, orgID],
    );
  }
  test("a foreign repository cannot be attached by identifier", async () => {
    seedRepo(B);
    await expect(
      withActor(actor, () =>
        AppRepo.connect({ appID: APP, type: "github", repoID }),
      ),
    ).rejects.toThrow();
    expect(database.query("SELECT * FROM app_repository").all()).toEqual([]);
    expect(published).toEqual([]);
  });
  test("active same-workspace repository remains usable", async () => {
    seedRepo(A);
    await withActor(actor, () =>
      AppRepo.connect({ appID: APP, type: "github", repoID }),
    );
    expect(
      database.query("SELECT workspace_id, repo_id FROM app_repository").all(),
    ).toEqual([{ workspace_id: A, repo_id: repoID }]);
  });
  test("manual deployment does not join a same-ID repository from another workspace", async () => {
    seedRepo(B);
    database.run(
      "INSERT INTO github_organization (workspace_id, id) VALUES (?, ?)",
      [A, orgID],
    );
    database.run(
      "INSERT INTO app_repository (workspace_id, id, app_id, repo_id) VALUES (?, 'connection', ?, ?)",
      [A, APP, repoID],
    );
    const client = spyOn(Github, "useClient").mockImplementation(async () => {
      throw new Error("Unexpected external client resolution");
    });
    try {
      await withActor(actor, () =>
        Run.triggerManualDeploy({
          id: RUN,
          appID: APP,
          ref: "main",
          stageName: "production",
        }),
      );
      expect(client).not.toHaveBeenCalled();
    } finally {
      client.mockRestore();
    }
  });
  test("retry does not join a same-ID app connection from another workspace", async () => {
    seedRepo(A);
    database.run(
      "INSERT INTO app_repository (workspace_id, id, app_id, repo_id) VALUES (?, 'connection', ?, ?)",
      [B, APP, repoID],
    );
    database.run(
      "INSERT INTO run (workspace_id, id, app_id) VALUES (?, ?, ?)",
      [A, RUN, APP],
    );
    const client = spyOn(Github, "useClient").mockImplementation(async () => {
      throw new Error("Unexpected external client resolution");
    });
    try {
      await withActor(actor, () =>
        Run.triggerRetry({ id: "runbbbbbbbbbbbbbbbbbbbbb", runID: RUN }),
      );
      expect(client).not.toHaveBeenCalled();
    } finally {
      client.mockRestore();
    }
  });
});

afterEach(() => {
  fake.reset();
  database.close();
});

describe("configuration ownership", () => {
  test("updating the same identifier leaves another workspace's environment unchanged", async () => {
    for (const id of [A, B])
      database.run(
        "INSERT INTO run_config (workspace_id, id, app_id, stage_pattern, aws_account_external_id, env) VALUES (?, ?, ?, 'production', ?, ?)",
        [
          id,
          ID,
          APP,
          id === A ? "111111111111" : "222222222222",
          JSON.stringify({ VALUE: id }),
        ],
      );
    await withActor(actor, () =>
      RunConfig.put({
        id: ID,
        appID: APP,
        stagePattern: "production",
        awsAccountExternalID: "111111111111",
        env: { VALUE: "updated" },
      }),
    );
    const rows = database
      .query("SELECT workspace_id, env FROM run_config ORDER BY workspace_id")
      .all();
    expect(rows).toEqual([
      { workspace_id: A, env: JSON.stringify({ VALUE: "updated" }) },
      { workspace_id: B, env: JSON.stringify({ VALUE: B }) },
    ]);
  });

  test.each(["app", "aws_account"])(
    "rejects a disconnected or foreign %s before writing",
    async (table) => {
      database.run(`DELETE FROM ${table} WHERE workspace_id = ?`, [A]);
      await expect(
        withActor(actor, () =>
          RunConfig.put({
            appID: APP,
            stagePattern: "*",
            awsAccountExternalID: "111111111111",
            env: { VALUE: "updated" },
          }),
        ),
      ).rejects.toThrow();
      expect(database.query("SELECT * FROM run_config").all()).toEqual([]);
      expect(published).toEqual([]);
    },
  );
});

describe("live authorization", () => {
  const request = (workspaceID?: string) =>
    http.request("/", {
      headers: {
        authorization: "Bearer boundary-token",
        ...(workspaceID ? { "x-sst-workspace": workspaceID } : {}),
      },
    });
  test("active account and member retain access", async () => {
    expect((await request()).status).toBe(200);
    expect((await request(A)).status).toBe(200);
    expect((await request(B)).status).toBe(401);
  });
  test.each(["account", "user", "workspace"])(
    "existing token cannot bypass deleted %s",
    async (table) => {
      database.run(`UPDATE ${table} SET time_deleted = '2026-10-17'`);
      expect((await request(A)).status).toBe(401);
      if (table === "account") expect((await request()).status).toBe(401);
    },
  );
  test.each(["account", "user", "workspace"])(
    "deleted %s cannot authorize workspace removal",
    async (table) => {
      database.run(`UPDATE ${table} SET time_deleted = '2026-10-17'`);
      await expect(
        withActor(accountActor, () => Workspace.remove(A)),
      ).rejects.toThrow();
      expect(
        database
          .query("SELECT time_deleted FROM workspace WHERE id = ?")
          .get(A),
      ).toEqual({ time_deleted: table === "workspace" ? "2026-10-17" : null });
    },
  );
  test("active members may remove a workspace and memberships are revoked", async () => {
    await withActor(accountActor, () => Workspace.remove(A));
    expect((await request(A)).status).toBe(401);
    expect(
      database
        .query("SELECT time_deleted FROM user WHERE workspace_id = ?")
        .get(A),
    ).toEqual({ time_deleted: "2026-10-17 12:00:00" });
  });
  test.each(["account", "user", "workspace"])(
    "Slack callback rechecks deleted %s after authorization",
    async (table) => {
      const authorize = await http.request("/slack/authorize", {
        headers: {
          authorization: "Bearer boundary-token",
          "x-sst-workspace": A,
        },
      });
      expect(authorize.status).toBe(302);
      const state = new URL(
        authorize.headers.get("location")!,
      ).searchParams.get("state")!;
      const cookie = authorize.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      database.run(`UPDATE ${table} SET time_deleted = '2026-10-17'`);
      const callback = await http.request(
        `/slack/callback?code=test&state=${encodeURIComponent(state)}`,
        { headers: { cookie } },
      );
      expect(callback.status).toBe(401);
    },
  );
});

describe("event ownership", () => {
  const envelope = {
    account: "111111111111",
    region: "us-east-1",
    source: "sst.runner",
    "detail-type": "runner.completed",
  };
  const buildID =
    "arn:aws:codebuild:us-east-1:111111111111:build/sst-runner-test:build-one";
  const event = () => ({
    ...envelope,
    detail: {
      properties: { workspaceID: A, runID: RUN, buildID },
      metadata: { actor },
    },
  });
  function seedRun() {
    database.run(
      "INSERT INTO run (workspace_id, id, app_id, aws_account_external_id, region, active, log) VALUES (?, ?, ?, ?, ?, 1, ?)",
      [
        A,
        RUN,
        APP,
        "111111111111",
        "us-east-1",
        JSON.stringify({
          engine: "codebuild",
          logGroup: "/aws/codebuild/sst-runner-test",
          logStream: "build-one",
        }),
      ],
    );
  }
  test("foreign-account detail cannot select a workspace, even with a valid run and actor", async () => {
    seedRun();
    const completed = spyOn(Run, "markRunCompleted").mockResolvedValue(
      undefined,
    );
    try {
      await runner({ ...event(), account: "222222222222" });
      expect(completed).not.toHaveBeenCalled();
      await runner(event());
      expect(completed).toHaveBeenCalledTimes(1);
    } finally {
      completed.mockRestore();
    }
  });
  test("wrong region, build, source, inactive run and disconnected records are rejected", async () => {
    seedRun();
    const completed = spyOn(Run, "markRunCompleted").mockResolvedValue(
      undefined,
    );
    try {
      await runner({ ...event(), source: "console.test" });
      await runner({ ...event(), region: "us-west-2" });
      const wrongBuild = event();
      wrongBuild.detail.properties.buildID += "-other";
      await runner(wrongBuild);
      for (const table of [
        "account",
        "aws_account",
        "workspace",
        "app",
        "run",
      ]) {
        if (table === "account") continue; // Runner authority is the connected AWS account, not a human token.
        database.run(`UPDATE ${table} SET time_deleted = '2026-10-17'`);
        await runner(event());
        database.run(`UPDATE ${table} SET time_deleted = NULL`);
      }
      database.run("UPDATE run SET active = NULL");
      await runner(event());
      expect(completed).not.toHaveBeenCalled();
    } finally {
      completed.mockRestore();
    }
  });
  test("CodeBuild failure events also bind the AWS account and exact recorded build", async () => {
    seedRun();
    const completed = spyOn(Run, "markRunCompleted").mockResolvedValue(
      undefined,
    );
    const failure = {
      ...envelope,
      source: "aws.codebuild",
      "detail-type": "CodeBuild Build State Change",
      detail: {
        "build-id": buildID,
        "build-status": "FAILED",
        "additional-information": {
          environment: {
            "environment-variables": [
              {
                name: "SST_RUNNER_EVENT",
                value: JSON.stringify({ workspaceID: A, runID: RUN }),
              },
            ],
          },
        },
      },
    };
    try {
      await codebuildHandler({ ...failure, account: "222222222222" });
      expect(completed).not.toHaveBeenCalled();
      await codebuildHandler(failure);
      expect(completed).toHaveBeenCalledTimes(1);
    } finally {
      completed.mockRestore();
    }
  });
  test("internal events require both the Console account and source", async () => {
    const internal = {
      ...envelope,
      source: "test-App-name.test",
      account: "999999999999",
    };
    expect(await internalActor(internal, { actor })).toEqual(actor);
    await expect(
      internalActor({ ...internal, account: "111111111111" }, { actor }),
    ).rejects.toThrow();
    await expect(
      internalActor({ ...internal, source: "sst.runner" }, { actor }),
    ).rejects.toThrow();
    database.run("UPDATE user SET time_deleted = '2026-10-17'");
    await expect(internalActor(internal, { actor })).rejects.toThrow();
  });
  test("the internal subscriber rejects a foreign publisher before dispatch", async () => {
    const orchestrate = spyOn(Run, "orchestrate").mockResolvedValue(undefined);
    const raw = {
      ...envelope,
      id: "test",
      version: "0",
      time: "2026-10-17T12:00:00Z",
      resources: [],
      source: "test-App-name.test",
      "detail-type": "run.created",
      detail: {
        metadata: { actor },
        properties: {
          appID: APP,
          stageName: "production",
          region: "us-east-1",
          awsAccountExternalID: "111111111111",
        },
      },
    };
    try {
      await expect(internal(raw, {} as never, () => {})).rejects.toThrow();
      expect(orchestrate).not.toHaveBeenCalled();
    } finally {
      orchestrate.mockRestore();
    }
  });
  test("S3 forwarding selects live connections by the AWS envelope account, never actor detail", async () => {
    const contexts: string[] = [];
    const put = spyOn(Stage, "put").mockImplementation(
      Object.assign(
        async () => {
          const current = useActor();
          if (current.type === "system")
            contexts.push(current.properties.workspaceID);
          return { appID: APP, stageID: "stageaaaaaaaaaaaaaaaaaaa" };
        },
        { schema: Stage.put.schema },
      ),
    );
    const raw = {
      ...envelope,
      source: "aws.s3",
      "detail-type": "Object Created",
      detail: {
        bucket: { name: "bootstrap" },
        object: { key: "snapshot/app/production/update.json" },
        metadata: {
          actor: {
            ...actor,
            properties: { ...actor.properties, workspaceID: B },
          },
        },
      },
    };
    try {
      await stack({ ...raw, account: "444444444444" });
      expect(contexts).toEqual([]);
      await stack(raw);
      expect(contexts).toEqual([A]);
      database.run("UPDATE aws_account SET time_deleted = '2026-10-17'");
      await stack(raw);
      expect(contexts).toEqual([A]);
    } finally {
      put.mockRestore();
    }
  });
  test("customer forwarding policy is separate from internal publishing", () => {
    const policy = eventBusPolicy(
      "arn:aws:events:us-east-1:999999999999:event-bus/test",
      "production",
    );
    expect(policy.Statement[0]!.Principal.AWS).toBe(
      "arn:aws:iam::999999999999:root",
    );
    expect(policy.Statement[1]!.Condition).toEqual({
      ArnLike: {
        "aws:PrincipalArn": "arn:aws:iam::*:role/SSTConsolePublisher",
      },
      StringEquals: {
        "events:source": ["aws.s3", "aws.codebuild", "sst.runner"],
      },
      Bool: { "events:eventBusInvocation": "true" },
    });
  });
});
