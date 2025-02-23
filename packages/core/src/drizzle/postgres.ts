import { drizzle } from "drizzle-orm/postgres-js";

import { default as pg } from "postgres";
import { Resource } from "sst";

const pgClient = pg({
  idle_timeout: 30000,
  connect_timeout: 30000,
  host: Resource.Postgres.host,
  database: Resource.Postgres.database,
  user: Resource.Postgres.username,
  password: Resource.Postgres.password,
  port: Resource.Postgres.port,
  max: parseInt(process.env.POSTGRES_POOL_MAX || "1"),
});

export const postgres = drizzle(pgClient, {});
