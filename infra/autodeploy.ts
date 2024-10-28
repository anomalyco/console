import fs from "fs";
import { createHash } from "crypto";
import { storage } from "./storage";
import { ALL_REGIONS } from "./util";

const buildspecPath = "packages/build/buildspec/index.mjs";
const version = createHash("sha256")
  .update(fs.readFileSync(buildspecPath))
  .digest("hex");
new aws.s3.BucketObjectv2("AutodeployBuildspec", {
  bucket: storage.name,
  key: `buildspec/${version}/index.mjs`,
  acl: "public-read",
});

if ($app.stage === "production" || $app.stage === "dev") {
  const repo = new aws.ecr.Repository("AutodeployRepository", {
    name: `${$app.name}-${$app.stage}-images`,
  });
  // new aws.ecr.RepositoryPolicy("AutodeployRepositoryPolicy", {
  //   repository: repo.name,
  //   policy: JSON.stringify({
  //     Version: "2012-10-17",
  //     Statement: [
  //       {
  //         Sid: "AllowPull",
  //         Effect: "Allow",
  //         Principal: {
  //           AWS: "*",
  //         },
  //         Action: ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
  //         Resource: [repo.arn],
  //       },
  //     ],
  //   }),
  // });
  new aws.ecr.ReplicationConfiguration("AutodeployReplication", {
    replicationConfiguration: {
      rules: [
        {
          repositoryFilters: [
            {
              filterType: "PREFIX_MATCH",
              filter: repo.name,
            },
          ],
          destinations: ALL_REGIONS.apply((regions) =>
            regions
              .filter((region) => region !== "us-east-1")
              .filter((region) => !region.startsWith("ap-"))
              .map((region) => ({
                region,
                registryId: repo.registryId,
              })),
          ),
        },
      ],
    },
  });
}
