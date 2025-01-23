#!/usr/bin/env bun

import { Resource } from "sst";

Bun.spawnSync(
  [
    `psql`,
    `-U${Resource.Postgres.username}`,
    `-h${Resource.Postgres.host}`,
    `${Resource.Postgres.database}`,
  ],
  {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PGPASSWORD: Resource.Postgres.password,
    },
  },
);
