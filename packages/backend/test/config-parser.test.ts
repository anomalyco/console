import { expect, test } from "bun:test";
import { handler } from "../src/function/run/config-parser";
import { StageName } from "@console/core/run/stage-name";
import type { Run } from "@console/core/run/index";
import { access, rm } from "node:fs/promises";

const content = Buffer.from(
  `export default $config({
  app(input) { return { name: input.stage }; }
});`,
).toString("base64");

test("parser treats stage and trigger values as data", async () => {
  const marker = `/tmp/opencode/config-parser-${crypto.randomUUID()}`;
  const stage = `"]; fs.writeFileSync(${JSON.stringify(marker)}, "ran"); stages=["data`;
  try {
    for (const trigger of [
      { type: "user", ref: stage },
      { type: "branch", branch: stage },
    ]) {
      const output = await handler({
        content,
        defaultStage: stage,
        trigger,
      } as Run.ConfigParserEvent);
      expect(output.stages).toEqual([
        { stage, isDefaultStage: true, app: { name: stage } },
      ]);
      await expect(access(marker)).rejects.toThrow();
    }
  } finally {
    await rm(marker, { force: true });
  }
});

test("parser preserves default and configured target behavior", async () => {
  const output = await handler({
    content,
    defaultStage: "production",
    trigger: { type: "user" } as Run.ConfigParserEvent["trigger"],
  });
  expect(output.stages[0]).toMatchObject({
    stage: "production",
    isDefaultStage: true,
  });
  const configured = await handler({
    content: Buffer.from(
      `export default $config({
      app({stage}) { return {name: stage}; },
      console: {autodeploy: {target() { return {stage: ["preview", "test"]}; }}}
    });`,
    ).toString("base64"),
    defaultStage: "production",
    trigger: { type: "branch" } as Run.ConfigParserEvent["trigger"],
  });
  expect(configured.stages.map((x: any) => x.stage)).toEqual([
    "preview",
    "test",
  ]);
  expect(configured.stages.every((x: any) => x.isDefaultStage === false)).toBe(
    true,
  );
});

test("manual stage names accept SST names, not JavaScript fragments", () => {
  for (const name of ["production", "preview-123", "DEV"])
    expect(StageName.safeParse(name).success).toBe(true);
  for (const name of ["", "stage\nnext", 'stage";', "../stage"])
    expect(StageName.safeParse(name).success).toBe(false);
});

test("manual rollout marker skips automation without disabling normal branch/PR targets", async () => {
  const current = Buffer.from(
    await Bun.file(new URL("../../../sst.config.ts", import.meta.url)).text(),
  ).toString("base64");
  for (const trigger of [
    { type: "branch", branch: "production", action: "pushed" },
    { type: "branch", branch: "dev", action: "pushed" },
    {
      type: "pull_request",
      head: "fix/auth-issuer-boundaries",
      number: 87,
      action: "pushed",
    },
  ]) {
    const result = await handler({
      content: current,
      defaultStage: "review",
      trigger: {
        ...trigger,
        commit: { message: "Refine issuer authorization [manual rollout]" },
      },
    } as Run.ConfigParserEvent);
    expect(result.error).toBe("config_target_returned_undefined");
  }
  for (const [trigger, expected] of [
    [{ type: "branch", branch: "production", action: "pushed" }, "production"],
    [{ type: "branch", branch: "dev", action: "pushed" }, "dev"],
    [
      { type: "branch", branch: "feature/test", action: "pushed" },
      "feature-test",
    ],
    [{ type: "pull_request", number: 87, action: "pushed" }, "pr-87"],
  ] as const) {
    const result = await handler({
      content: current,
      defaultStage: "unused",
      trigger,
    } as Run.ConfigParserEvent);
    expect(result.stages?.[0]?.stage).toBe(expected);
  }
  for (const trigger of [
    { type: "branch", branch: "production", action: "removed" },
    { type: "tag", tag: "v1", action: "pushed" },
  ]) {
    const result = await handler({
      content: current,
      defaultStage: "unused",
      trigger,
    } as Run.ConfigParserEvent);
    expect(result.error).toBe("config_target_returned_undefined");
  }
  const manual = await handler({
    content: current,
    defaultStage: "production",
    trigger: { type: "user" } as Run.ConfigParserEvent["trigger"],
  });
  expect(manual.stages?.[0]?.stage).toBe("production");
});
