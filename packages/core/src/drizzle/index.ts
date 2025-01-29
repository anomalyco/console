import { drizzle } from "drizzle-orm/planetscale-serverless";
import { Client } from "@planetscale/database";
import { Resource } from "sst";
import { fetch } from "undici";
export * from "drizzle-orm";
export { MySqlColumn } from "drizzle-orm/mysql-core";

const client = new Client({
  host: Resource.Database.host,
  username: Resource.Database.username,
  password: Resource.Database.password,
  fetch,
});

export const db = drizzle(client, {
  logger:
    process.env.DRIZZLE_LOG === "true"
      ? {
          logQuery(query, params) {
            console.log({
              query,
              params: params.length,
            });
          },
        }
      : undefined,
});

import { drizzle as drizzlePG } from "drizzle-orm/postgres-js";

import { default as pg } from "postgres";

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

export const postgres = drizzlePG(pgClient, {});
