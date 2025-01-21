#!/usr/bin/env bun

import { Resource } from "sst";

Bun.spawnSync(
  [
    `mysql`,
    `-u${Resource.Database.username}`,
    `-p${Resource.Database.password}`,
    `-h${Resource.Database.host}`,
    `${Resource.Database.database}`,
  ],
  {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
    },
  },
);
