import { vpc } from "./network";
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
          value: "1024",
          applyMethod: "pending-reboot",
        },
      ],
    },
  },
});
