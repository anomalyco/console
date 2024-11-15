import * as fs from "fs/promises";
import { build } from "esbuild";
import { Run } from "@console/core/run";
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
    console.log("errors", buildRet.errors);
    return { error: "config_build_failed" };
  }

  // Import the config
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
      `const trigger = ${JSON.stringify(evt.trigger)};`,
      // Resolve target stage
      `let target, stage, isDefaultStage;`,
      `if (trigger.type === "user") {`,
      `  stage = "${evt.defaultStage}";`,
      `  isDefaultStage = true;`,
      `} else {`,
      `  if (!mod.console?.autodeploy?.target) {`,
      `    stage = "${evt.defaultStage}";`,
      `    isDefaultStage = false;`,
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
      `    stage = target.stage;`,
      `    isDefaultStage = false;`,
      `  }`,
      `}`,
      // Resolve runner
      `const runner = typeof mod.console?.autodeploy?.runner === "function"`,
      `  ? mod.console?.autodeploy?.runner?.({stage})`,
      `  : (mod.console?.autodeploy?.runner ?? target?.runner);`,
      // Resolve app config
      `const app = mod.app({stage});`,
      `fs.writeFileSync("/tmp/eval-output.mjs", JSON.stringify({app, stage, runner, isDefaultStage}));`,
    ].join("\n")
  );
  const evalRet = spawnSync("node /tmp/eval.mjs", {
    stdio: "pipe",
    shell: true,
  });
  if (evalRet.status !== 0) {
    console.log(evalRet.stdout?.toString());
    console.log(evalRet.stderr?.toString());
    return { error: "config_evaluate_failed" };
  }
  const output = await fs.readFile("/tmp/eval-output.mjs", "utf-8");
  console.log("deploy config", output);

  return JSON.parse(output);
}
