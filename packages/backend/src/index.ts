import { MySQLBackend } from "@openauthjs/openevent/backend/mysql";
import { createProcessor } from "@openauthjs/openevent/processor";
import { Resource } from "sst";

const processor = createProcessor({
  backend: MySQLBackend({
    host: Resource.Database.host,
    port: Resource.Database.port,
    user: Resource.Database.username,
    password: Resource.Database.password,
    // migrate: Resource.App.stage !== "production",
    ssl: {
      rejectUnauthorized: true,
    },
  }),
});

processor.start();

import { app } from "./api/api";
export default {
  port: 3001,
  fetch: app.fetch,
};
