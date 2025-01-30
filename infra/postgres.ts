import { vpc } from "./network";
import { database } from "./planetscale";
import { isPermanent } from "./stage";

export const postgres = new sst.aws.Aurora("Postgres", {
  vpc,
  engine: "postgres",
  scaling: isPermanent
    ? undefined
    : {
        min: "0 ACU",
        max: "1 ACU",
      },
  transform: {
    clusterParameterGroup: {
      parameters: [
        {
          name: "rds.logical_replication",
          value: "1",
          applyMethod: "pending-reboot",
        },
        {
          name: "max_slot_wal_keep_size",
          value: "10240",
          applyMethod: "pending-reboot",
        },
      ],
    },
  },
});

new sst.x.DevCommand("Studio", {
  link: [postgres],
  dev: {
    command: "bun pg studio",
    directory: "packages/core",
    autostart: true,
  },
});

const migrator = new sst.aws.Function("DatabaseMigrator", {
  handler: "packages/functions/src/migrator.handler",
  link: [postgres, database],
  vpc,
  copyFiles: [
    {
      from: "packages/core/migrations-pg",
      to: "./migrations-pg",
    },
  ],
});

if (!$dev) {
  new aws.lambda.Invocation("DatabaseMigratorInvocation", {
    input: Date.now().toString(),
    functionName: migrator.name,
  });
}
