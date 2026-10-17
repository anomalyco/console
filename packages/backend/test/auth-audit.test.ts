import { expect, spyOn, test } from "bun:test";
import { authAudit, auditContext } from "../src/function/auth/audit";

test("audit emits only allowlisted identity and AWS transport metadata", () => {
  const entries: string[] = [];
  const log = spyOn(console, "log").mockImplementation((value: string) => {
    entries.push(value);
  });
  try {
    const identity = {
      email: "test@example.com",
      impersonate: "workspace-a",
      code: "not-for-logs",
      token: "not-for-logs",
      cookie: "not-for-logs",
    };
    auditContext.run(
      { requestID: "aws-request", sourceIP: "192.0.2.1" },
      () => {
        authAudit("verify", "invalid", identity);
      },
    );
    expect(entries.length).toBe(1);
    expect(entries[0]?.includes("not-for-logs")).toBe(false);
    expect(Object.keys(JSON.parse(entries[0]!)).sort()).toEqual(
      [
        "event",
        "requestID",
        "sourceIP",
        "action",
        "result",
        "email",
        "impersonate",
      ].sort(),
    );
  } finally {
    log.mockRestore();
  }
});

test("concurrent audit contexts do not mix request identities", async () => {
  const entries: string[] = [];
  const log = spyOn(console, "log").mockImplementation((value: string) => {
    entries.push(value);
  });
  try {
    await Promise.all(
      ["one", "two"].map((requestID) =>
        auditContext.run({ requestID }, async () => {
          await Promise.resolve();
          authAudit("request", "success", {
            email: `${requestID}@example.com`,
          });
        }),
      ),
    );
    expect(
      entries
        .map((entry) => JSON.parse(entry))
        .every((entry) => entry.email === `${entry.requestID}@example.com`),
    ).toBe(true);
  } finally {
    log.mockRestore();
  }
});
