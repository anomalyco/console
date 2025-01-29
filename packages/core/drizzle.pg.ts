import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

const connection = {
  user: Resource.Postgres.username,
  password: Resource.Postgres.password,
  host: Resource.Postgres.host,
};

console.log(connection);

export default defineConfig({
  out: "./migrations-pg/",
  strict: true,
  schema: "./src/**/*.pg.ts",
  verbose: true,
  dialect: "postgresql",
  dbCredentials: {
    url: `postgres://${connection.user}:${connection.password}@${connection.host}/console`,
  },
});
