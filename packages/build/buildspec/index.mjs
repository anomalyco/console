/** @typedef {import("../../core/src/run").Run.RunnerEvent} RunnerEvent */
/** @typedef {import("aws-lambda").Context} Context */
import { spawnSync } from "child_process";
import fs from "fs";
import semver from "semver";
import { build } from "esbuild";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const ROOT_PATH = "/tmp";
const REPO_DIR_NAME = "repo";
const REPO_PATH = `${ROOT_PATH}/${REPO_DIR_NAME}`;
const eb = new EventBridgeClient({});

let isWarm = false;

/**
 * @param {RunnerEvent} event
 * @param {Context} context
 */
export async function handler(event, context) {
  console.log("isWarm:", isWarm);
  if (event.warm && isWarm) return "warmed";
  isWarm = true;
  const APP_PATH = path.join(REPO_PATH, event.repo.path ?? "");

  console.log("[sst.deploy.start]");

  let error;
  let packageJson;
  let sstConfig;

  try {
    await publish("runner.started", {
      logGroup: context.logGroupName,
      logStream: context.logStreamName,
      awsRequestId: context.awsRequestId,
      timestamp: Date.now(),
    });

    checkout();
    packageJson = await loadPackageJson();
    await installNode();
    sstConfig = await loadSstConfig();
    if (event.warm) return "warmed";
    await runWorkflow();
  } catch (e) {
    console.error(e);
    error = e.message;
  } finally {
    await publish("runner.completed", { error });
    console.log("[sst.deploy.end]");
  }

  function checkout() {
    const { warm, repo, trigger } = event;

    // Clone or fetch the repo
    if (fs.existsSync(REPO_PATH)) {
      process.chdir(REPO_PATH);
      shell("git reset --hard");
      shell(`git remote set-url origin ${repo.cloneUrl}`);
    } else {
      process.chdir(ROOT_PATH);
      shell(`git clone --depth 1 ${repo.cloneUrl} ${REPO_DIR_NAME}`);
    }

    // Checkout commit
    if (!warm) {
      process.chdir(REPO_PATH);
      shell(`git fetch origin ${trigger.commit.id}`);
      shell(`git -c advice.detachedHead=false checkout ${trigger.commit.id}`);
    }
  }

  async function loadPackageJson() {
    process.chdir(APP_PATH);

    try {
      return JSON.parse(fs.readFileSync("package.json", "utf8"));
    } catch (e) {}
    return {};
  }

  async function loadSstConfig() {
    process.chdir(APP_PATH);

    const OUTPUT_PATH = "/tmp/sst.config.mjs";
    fs.rmSync(OUTPUT_PATH, { force: true });

    const buildRet = await build({
      mainFields: ["module", "main"],
      format: "esm",
      platform: "node",
      sourcemap: "inline",
      stdin: {
        contents: fs
          .readFileSync("sst.config.ts", "utf8")
          // remove global imports
          .replace(/^import.*?;?\s*$/gm, ""),
        sourcefile: "sst.config.ts",
        loader: "ts",
      },
      outfile: OUTPUT_PATH,
      write: true,
      bundle: false,
      banner: {
        js: ["const $config = (input) => input;"].join("\n"),
      },
    });
    if (buildRet.errors.length) {
      console.error(buildRet.errors);
      throw new Error("Failed to load sst.config.ts");
    }

    return (await import(OUTPUT_PATH)).default;
  }

  async function installNode() {
    if (
      findUp(".n-node-version") ||
      findUp(".node-version") ||
      findUp(".nvmrc") ||
      packageJson.engines?.node
    )
      shell(`n auto`);
  }

  async function installSst() {
    // Check if SST is installed locally
    let searchPath = path.resolve(APP_PATH);
    while (true) {
      const sstPath = path.join(searchPath, "node_modules/.bin/sst");
      if (fs.existsSync(sstPath)) {
        console.log("Using locally installed SST binary at", sstPath);
        return sstPath;
      }
      if (searchPath === path.resolve(REPO_PATH)) break;
      searchPath = path.resolve(searchPath, "..");
    }

    // Install SST globally
    const { stage } = event;
    const semverPattern = sstConfig.app({ stage }).version;
    console.log("Installing SST globally, version:", semverPattern ?? "Latest");

    shell(`npm -g install sst@${semverPattern ?? "latest"}`);
    return "sst";
  }

  async function runWorkflow() {
    const { warm, stage, trigger } = event;
    if (warm) return;

    const context = {
      stage,
      trigger,
      install,
      deploy,
      remove,
      shell,
    };
    const workflow =
      sstConfig.console?.autodeploy?.workflow ??
      (async (context) => {
        install();
        const sstPath = await installSst();
        context.trigger.action === "removed"
          ? remove(sstPath)
          : deploy(sstPath);
      });

    await workflow(context);
  }

  function install() {
    process.chdir(APP_PATH);

    if (findUp("yarn.lock")) {
      if (packageJson.packageManager?.startsWith("yarn@"))
        shell(`npm install -g ${packageJson.packageManager}`);
      shell("yarn install --frozen-lockfile");
    } else if (findUp("pnpm-lock.yaml")) {
      packageJson.packageManager?.startsWith("pnpm@")
        ? shell(`npm install -g ${packageJson.packageManager}`)
        : shell("npm install -g pnpm");
      shell("pnpm install --frozen-lockfile");
    } else if (findUp("bun.lockb")) {
      shell("npm install -g bun");
      shell("bun install --frozen-lockfile");
    } else if (findUp("package-lock.json")) shell("npm ci");
    else if (findUp("package.json")) shell("npm install");
  }

  /**
   * @param {string} sstPath
   */
  function deploy(sstPath) {
    process.chdir(APP_PATH);

    const { stage, credentials, runID } = event;
    shell(`${sstPath} deploy --stage ${stage}`, {
      env: {
        AWS_ACCESS_KEY_ID: credentials.accessKeyId,
        AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        AWS_SESSION_TOKEN: credentials.sessionToken,
        SST_AWS_NO_PROFILE: "1",
        SST_RUN_ID: runID,
      },
    });
  }

  /**
   * @param {string} sstPath
   */
  function remove(sstPath) {
    process.chdir(APP_PATH);

    const { stage, credentials, runID } = event;
    shell(`${sstPath} remove --stage ${stage}`, {
      env: {
        AWS_ACCESS_KEY_ID: credentials.accessKeyId,
        AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        AWS_SESSION_TOKEN: credentials.sessionToken,
        SST_AWS_NO_PROFILE: "1",
        SST_RUN_ID: runID,
      },
    });
  }

  /**
   * @param {string} command
   * @param {any} options
   */
  function shell(command, options = {}) {
    const { env } = event;

    console.log(`Running: ${command}`);
    const ret = spawnSync(command, {
      stdio: "inherit",
      shell: true,
      ...options,
      env: {
        ...process.env,
        ...env,
        ...options.env,
      },
    });

    if (ret.status !== 0) {
      throw new Error(`Failed to run: ${command}`);
    }
    return ret;
  }

  /**
   * @param {string} type
   * @param {any} payload
   */
  async function publish(type, payload) {
    const { warm, engine, workspaceID, runID } = event;
    if (warm) return;

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "sst.external",
            DetailType: type,
            Detail: JSON.stringify({
              properties: {
                ...payload,
                engine,
                workspaceID,
                runID,
              },
            }),
          },
        ],
      })
    );
  }

  function findUp(filename) {
    let dir = APP_PATH;
    while (true) {
      if (fs.existsSync(path.join(dir, filename))) return dir;
      if (dir === REPO_PATH) break;
      dir = path.resolve(dir, "..");
    }
  }
}
