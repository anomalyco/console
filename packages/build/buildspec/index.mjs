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
export async function handler({
  runID,
  stage,
  trigger,
  repo,
  engine,
  workspaceID,
  env,
  cache,
  force,
}) {
  const SST_CONFIG_PATH = "/tmp/sst.config.mjs";
  const ROOT_PATH = "/root";
  const REPO_DIR_NAME = "repo";
  const REPO_PATH = `${ROOT_PATH}/${REPO_DIR_NAME}`;
  const APP_PATH = path.join(REPO_PATH, repo.path ?? "");

  console.log("[sst.deploy.start]");

  let error;
  let packageJson;
  let sstConfig;
  let bun;

  try {
    await publish("runner.started");

    // set SST required environment variable
    process.env.SST_AWS_NO_PROFILE = "1";
    process.env.SST_RUN_ID = runID;
    process.env.SST_STAGE = stage;
    Object.entries(env).map(([k, v]) => (process.env[k] = v));

    await resetCache();
    await restoreCache(".git");
    await checkout();
    for (const item of cache?.paths ?? []) await restoreCache(item);
    packageJson = await loadPackageJson();
    installNode();
    installUv();
    createDockerBuilder();
    sstConfig = await loadSstConfig();
    installSstGlobally();

    sstConfig.console?.autodeploy?.workflow
      ? runWorkflow()
      : (() => {
          installNodeDeps();
          const sstPath = findLocalSstBinary() ?? "sst";
          trigger.action === "removed" || trigger.action === "remove"
            ? shell(`${sstPath} remove`)
            : shell(`${sstPath} deploy`);
        })();

    for (const item of [".git", ...(cache?.paths ?? [])])
      await storeCache(item);
  } catch (e) {
    console.error(e);
    error = e.message;
  } finally {
    await publish("runner.completed", { error });
    console.log("[sst.deploy.end]");
  }

  async function checkout() {
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

    fs.rmSync(SST_CONFIG_PATH, { force: true });

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
      outfile: SST_CONFIG_PATH,
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

    return (await import(SST_CONFIG_PATH)).default;
  }

  function installNode() {
    if (
      findUp(".n-node-version") ||
      findUp(".node-version") ||
      findUp(".nvmrc") ||
      packageJson.engines?.node
    )
      shell(`n auto`);
  }
  function installUv() {
    if (findInRepo("uv.lock")) shell("pip install uv");
  }
  function createDockerBuilder() {
    const builder = "sst-builder";
    shell(
      `docker buildx create --driver docker-container --driver-opt image=mirror.gcr.io/moby/buildkit --name ${builder}`,
    );
    process.env.BUILDX_BUILDER = builder;
  }
  function installBun() {
    if (bun) return;
    packageJson.packageManager?.startsWith("bun@")
      ? shell(`npm install -g ${packageJson.packageManager}`)
      : shell("npm install -g bun");
    bun = true;
  }

  function installSstGlobally() {
    // Check if SST will be installed locally
    if (packageJson.dependencies?.sst || packageJson.devDependencies?.sst) {
      console.log("SST binary will be isntalled locally");
      return;
    }

    // Install SST globally
    const semverPattern = sstConfig.app({ stage }).version;
    console.log("Installing SST globally, version:", semverPattern ?? "Latest");

    shell(`npm -g install sst@${semverPattern ?? "latest"}`);
    return "sst";
  }

  function installNodeDeps() {
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
    } else if (findUp("bun.lockb") || findUp("bun.lock")) {
      installBun();
      shell("bun install --frozen-lockfile");
    } else if (findUp("package-lock.json")) shell("npm ci");
    else if (findUp("package.json")) shell("npm install");
  }

  async function resetCache() {
    if (!force) return;

    console.log("Clearing all cache because of force deploy");

    try {
      shell(`aws s3 rm --recursive s3://${cache.bucket}/${cache.prefix}`);
    } catch (e) {
      console.error("Failed to clear cache", e);
    }
  }

  /**
   * @param {string} path
   */
  async function storeCache(item) {
    const cacheKey = createHash("sha256").update(item).digest("hex");
    const s3Key = `${cache.prefix}/${cacheKey}.tar.gz`;
    const itemPath = path.isAbsolute(item) ? item : path.join(REPO_PATH, item);

    console.log(`Storing cache for ${item}`);

    try {
      const dirname = path.dirname(itemPath);
      const basename = path.basename(itemPath);
      shell(
        `tar -czf - -C ${dirname} ${basename} | aws s3 cp - s3://${cache.bucket}/${s3Key}`,
      );
    } catch (e) {
      console.error("Failed to store cache", e);
    }
  }

  /**
   * @param {string} path
   */
  async function restoreCache(item) {
    const cacheKey = createHash("sha256").update(item).digest("hex");
    const s3Key = `${cache.prefix}/${cacheKey}.tar.gz`;
    const itemPath = path.isAbsolute(item) ? item : path.join(REPO_PATH, item);

    console.log(`Restoring cache for ${item}`);

    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: cache.bucket,
          Key: s3Key,
        }),
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
        `aws s3 cp s3://${cache.bucket}/${s3Key} - | tar -xzf - -C ${dirname}`,
      );
    } catch (e) {
      console.error("Failed to restore cache", e);
    }
  }

  /**
   * @param {string} command
   */
  function shell(command) {
    console.log(`Running: ${command}`);
    const ret = spawnSync(command, {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
      },
    });

    if (ret.status !== 0) {
      throw new Error(`Failed to run: ${command}`);
    }
    return ret;
  }

  /* Helpers */

  /**
   * @param {string} type
   * @param {any} payload
   */
  async function publish(type, payload) {
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
      }),
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

  function findInRepo(filename, dir = APP_PATH) {
    const children = fs.readdirSync(dir);
    for (const child of children) {
      const childPath = path.join(dir, child);
      const stat = fs.statSync(childPath);
      if (stat.isFile() && child === filename) return true;
      if (stat.isDirectory() && findInRepo(filename, childPath)) return true;
    }
    return false;
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

  function runWorkflow() {
    installBun();

    const WORKFLOW_SCRIPT = "sst.workflow.ts";
    const WORKFLOW_RESULT = "sst.workflow.result.json";
    console.log("Creating workflow file", WORKFLOW_SCRIPT);
    fs.writeFileSync(
      WORKFLOW_SCRIPT,
      [
        `import { default as sstConfig } from "${SST_CONFIG_PATH}";`,
        `import { $ } from "bun";`,
        `import fs from "fs";`,
        `try {`,
        `  await sstConfig.console.autodeploy.workflow({ $, event: ${JSON.stringify(
          trigger,
        )} });`,
        `} catch (e) {`,
        `  const result = e.name === "ShellError"`,
        `    ? { error: e.stderr.toString().trim() }`,
        `    : { error: e.message };`,
        `  fs.writeFileSync("${WORKFLOW_RESULT}", JSON.stringify(result));`,
        `  process.exit(1);`,
        `}`,
      ].join("\n"),
    );

    try {
      shell(`bun ${WORKFLOW_SCRIPT}`);
    } catch (shellError) {
      try {
        shellError = new Error(
          JSON.parse(fs.readFileSync(WORKFLOW_RESULT, "utf8")).error,
        );
      } catch (_) {}
      throw shellError;
    }
  }
}
