import { drizzle } from "drizzle-orm/planetscale-serverless";
import { Client } from "@planetscale/database";
import { Resource } from "sst";
import { fetch } from "undici";
export * from "drizzle-orm";

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
