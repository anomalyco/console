/** @typedef {import("../../core/src/run").Run.RunnerEvent} RunnerEvent */
import { spawnSync } from "child_process";
import fs from "fs";
import { createHash } from "crypto";
import { build } from "esbuild";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const eb = new EventBridgeClient({});
const s3 = new S3Client({});

/**
 * @param {RunnerEvent} event
 */
export async function handler(event) {
  const ROOT_PATH = "/root";
  const REPO_DIR_NAME = "repo";
  const REPO_PATH = `${ROOT_PATH}/${REPO_DIR_NAME}`;
  const APP_PATH = path.join(REPO_PATH, event.repo.path ?? "");

  console.log("[sst.deploy.start]");

  let error;
  let packageJson;
  let sstConfig;

  try {
    await publish("runner.started");

    resetCache();
    await restore(".git");
    checkout();
    for (const item of event.cache?.paths ?? []) await restore(item);
    packageJson = await loadPackageJson();
    await installNode();
    sstConfig = await loadSstConfig();
    await runWorkflow();

    for (const item of [".git", ...(event.cache?.paths ?? [])])
      await cache(item);
  } catch (e) {
    console.error(e);
    error = e.message;
  } finally {
    await publish("runner.completed", { error });
    console.log("[sst.deploy.end]");
  }

  function checkout() {
    const { repo, trigger } = event;

    // Clone or fetch the repo
    if (fs.existsSync(path.join(REPO_PATH, ".git"))) {
      process.chdir(REPO_PATH);
      shell("git reset --hard");
      shell(`git remote set-url origin ${repo.cloneUrl}`);
    } else {
      process.chdir(ROOT_PATH);
      shell(`git clone --depth 1 ${repo.cloneUrl} ${REPO_DIR_NAME}`);
    }

    // Checkout commit
    process.chdir(REPO_PATH);
    shell(`git fetch origin ${trigger.commit.id}`);
    shell(`git -c advice.detachedHead=false checkout ${trigger.commit.id}`);
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

  async function resetCache() {
    const { cache, force } = event;

    if (!force) return;

    console.log("Clearing all cache because of force deploy");

    try {
      shell(`aws s3 rm --recursive s3://${cache.bucket}/${cache.prefix}`);
    } catch (e) {
      console.error("Failed to clear cache", e);
    }
  }

  /* Workflow */

  async function runWorkflow() {
    const context = {
      stage: event.stage,
      trigger: event.trigger,
      unlock,
      install,
      installSst,
      deploy,
      remove,
      shell,
    };

    return sstConfig.console?.autodeploy?.workflow
      ? await sstConfig.console.autodeploy.workflow(context)
      : workflow(context, event.force);
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

  async function installSst() {
    // Check if SST is installed locally
    const localPath = findLocalSstBinary();
    if (localPath) {
      console.log("Using locally installed SST binary at", localPath);
      return;
    }

    // Install SST globally
    const { stage } = event;
    const semverPattern = sstConfig.app({ stage }).version;
    console.log("Installing SST globally, version:", semverPattern ?? "Latest");

    shell(`npm -g install sst@${semverPattern ?? "latest"}`);
    return "sst";
  }

  function unlock() {
    process.chdir(APP_PATH);

    const { stage } = event;
    const sstPath = findLocalSstBinary() ?? "sst";
    shell(`${sstPath} unlock --stage ${stage}`, {
      env: {
        SST_AWS_NO_PROFILE: "1",
      },
    });
  }

  function deploy() {
    process.chdir(APP_PATH);

    const { stage, runID } = event;
    const sstPath = findLocalSstBinary() ?? "sst";
    shell(`${sstPath} deploy --stage ${stage}`, {
      env: {
        SST_AWS_NO_PROFILE: "1",
        SST_RUN_ID: runID,
      },
    });
  }

  function remove() {
    process.chdir(APP_PATH);

    const { stage, runID } = event;
    const sstPath = findLocalSstBinary() ?? "sst";
    shell(`${sstPath} remove --stage ${stage}`, {
      env: {
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
   * @param {string} path
   */
  async function cache(item) {
    const { cache } = event;
    const cacheKey = createHash("sha256").update(item).digest("hex");
    const s3Key = `${cache.prefix}/${cacheKey}.tar.gz`;
    const itemPath = path.isAbsolute(item) ? item : path.join(REPO_PATH, item);

    console.log(`Storing cache for ${item}`);

    try {
      const dirname = path.dirname(itemPath);
      const basename = path.basename(itemPath);
      shell(
        `tar -czf - -C ${dirname} ${basename} | aws s3 cp - s3://${cache.bucket}/${s3Key}`
      );
    } catch (e) {
      console.error("Failed to store cache", e);
    }
  }

  /**
   * @param {string} path
   */
  async function restore(item) {
    const { cache } = event;
    const cacheKey = createHash("sha256").update(item).digest("hex");
    const s3Key = `${cache.prefix}/${cacheKey}.tar.gz`;
    const itemPath = path.isAbsolute(item) ? item : path.join(REPO_PATH, item);

    console.log(`Restoring cache for ${item}`);

    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: cache.bucket,
          Key: s3Key,
        })
      );
    } catch (e) {
      if (e.name === "NotFound") {
        console.log("Cache not found, skipping restore");
      } else {
        console.error("Failed to restore cache", e);
      }
      return;
    }

    try {
      const dirname = path.dirname(itemPath);
      shell(`mkdir -p ${dirname}`);
      shell(
        `aws s3 cp s3://${cache.bucket}/${s3Key} - | tar -xzf - -C ${dirname}`
      );
    } catch (e) {
      console.error("Failed to restore cache", e);
    }
  }

  /* Helpers */

  /**
   * @param {string} type
   * @param {any} payload
   */
  async function publish(type, payload) {
    const { engine, workspaceID, runID } = event;

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "sst.runner",
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

  function findLocalSstBinary() {
    let searchPath = path.resolve(APP_PATH);
    while (true) {
      const sstPath = path.join(searchPath, "node_modules/.bin/sst");
      if (fs.existsSync(sstPath)) {
        return sstPath;
      }
      if (searchPath === path.resolve(REPO_PATH)) break;
      searchPath = path.resolve(searchPath, "..");
    }
  }
}

/**
 * @param {any} context
 */
async function workflow(context, force) {
  context.install();
  await context.installSst();
  if (force) context.unlock();
  context.trigger.action === "removed" ? context.remove() : context.deploy();
}
