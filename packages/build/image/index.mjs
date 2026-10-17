/** @typedef {import("../../core/src/run").RunnerEvent} RunnerEvent */
/** @typedef {import("aws-lambda").Context} Context */
import fs from "fs";
import path from "path";
import https from "https";

/** @type {string} */
let currentVersion;

/** @type {any} */
let buildspec;

/**
 * @param {RunnerEvent} event
 * @param {Context} context
 */
export async function handler(event, context) {
  const version = event.buildspec.version;
  const bucket = event.buildspec.bucket;
  console.log("buildspec version:", version);

  if (version !== currentVersion) {
    await download(
      `https://${bucket}.s3.amazonaws.com/buildspec/${version}/index.mjs`,
      `/tmp/buildspec/${version}/index.mjs`
    );
    buildspec = await import(`/tmp/buildspec/${version}/index.mjs`);
    currentVersion = version;
  }

  await buildspec.handler(event, context);
}

/**
 * @param {string} url
 * @param {string} filePath
 */
async function download(url, filePath) {
  console.log("download buildspec from", url, "to", filePath);
  const fileDir = path.dirname(filePath);
  fs.rmSync(fileDir, { force: true, recursive: true });
  fs.mkdirSync(fileDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            resolve("Download completed!");
          });
        });

        file.on("error", (err) => {
          fs.unlink(filePath, () => reject(err));
        });
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => reject(err));
      });
  });
}
