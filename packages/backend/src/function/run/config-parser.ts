import * as fs from "fs/promises";
import { build } from "esbuild";
import type { Run } from "@console/core/run/index";
import { spawnSync } from "child_process";

export async function handler(evt: Run.ConfigParserEvent) {
  // Decode content
  const contents = Buffer.from(evt.content, "base64")
    .toString("utf-8")
    // remove global imports
    .replace(/^import.*?;?\s*$/gm, "");

  // Run esbuild
  await fs.rm("/tmp/sst.config.mjs", { force: true });
  const buildRet = await build({
    mainFields: ["module", "main"],
    format: "esm",
    platform: "node",
    sourcemap: "inline",
    stdin: {
      contents,
      sourcefile: "sst.config.ts",
      loader: "ts",
    },
    outfile: "/tmp/sst.config.mjs",
    write: true,
    bundle: false,
    banner: {
      js: ["const $config = (input) => input;"].join("\n"),
    },
  });
  if (buildRet.errors.length) {
    console.log("config build failed", { errors: buildRet.errors.length });
    return { error: "config_build_failed" };
  }

  // Import the config
  // Pass caller-controlled values as data, never as executable source.
  await fs.writeFile(
    "/tmp/eval-input.json",
    JSON.stringify({
      trigger: evt.trigger,
      defaultStage: evt.defaultStage,
    }),
  );
  await fs.rm("/tmp/eval.mjs", { force: true });
  await fs.rm("/tmp/eval-output.mjs", { force: true });
  await fs.writeFile(
    "/tmp/eval.mjs",
    [
      `import fs from "fs";`,
      `import mod from "./sst.config.mjs";`,
      // Ensure SST v3 app
      `if (mod.stacks || mod.config) {`,
      `  fs.writeFileSync("/tmp/eval-output.mjs", JSON.stringify({error:"config_v2_unsupported"}));`,
      `  process.exit(0);`,
      `}`,
      // Handle 2 cases:
      // - latest format: `autodeploy.target` + `autodeploy.runner`
      // - legacy format: `autodeploy.target`
      `const { trigger, defaultStage } = JSON.parse(fs.readFileSync("/tmp/eval-input.json", "utf8"));`,
      // Resolve target stage(s)
      `let target, stages, isDefaultStage;`,
      `if (trigger.type === "user") {`,
      `  stages = [defaultStage];`,
      `  isDefaultStage = true;`,
      `} else {`,
      `  if (!mod.console?.autodeploy?.target) {`,
      `    stages = [defaultStage];`,
      `    isDefaultStage = true;`,
      `  }`,
      `  else {`,
      `    target = mod.console.autodeploy.target(trigger);`,
      `    if (!target) {`,
      `      fs.writeFileSync("/tmp/eval-output.mjs", JSON.stringify({error:"config_target_returned_undefined"}));`,
      `      process.exit(0);`,
      `    }`,
      `    if (!target.stage) {`,
      `      fs.writeFileSync("/tmp/eval-output.mjs", JSON.stringify({error:"config_target_no_stage"}));`,
      `      process.exit(0);`,
      `    }`,
      `    stages = Array.isArray(target.stage) ? target.stage : [target.stage];`,
      `    isDefaultStage = false;`,
      `  }`,
      `}`,
      // Write output
      `fs.writeFileSync("/tmp/eval-output.mjs", JSON.stringify({`,
      `  stages: stages.map((stage) => ({`,
      `    stage,`,
      `    isDefaultStage,`,
      //   Resolve runner
      `    runner: typeof mod.console?.autodeploy?.runner === "function"`,
      `      ? mod.console?.autodeploy?.runner?.({stage})`,
      `      : (mod.console?.autodeploy?.runner ?? target?.runner),`,
      //   Resolve app config
      `    app: mod.app({stage}),`,
      `  })),`,
      `}));`,
    ].join("\n"),
  );
  const evalRet = spawnSync("node /tmp/eval.mjs", {
    stdio: "pipe",
    shell: true,
  });
  if (evalRet.status !== 0) {
    console.log("config evaluation failed", { status: evalRet.status });
    return { error: "config_evaluate_failed" };
  }
  const output = await fs.readFile("/tmp/eval-output.mjs", "utf-8");

  return JSON.parse(output);
}
