import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

const connection = {
  user: Resource.Database.username,
  password: Resource.Database.password,
  host: Resource.Database.host,
};
console.log(connection);
export default defineConfig({
  out: "./migrations/",
  strict: true,
  schema: "./src/**/*.sql.ts",
  verbose: true,
  dialect: "mysql",
  dbCredentials: {
    url: `mysql://${connection.user}:${connection.password}@${connection.host}/sst?ssl={"rejectUnauthorized":true}`,
    ssl: {
      rejectUnauthorized: true,
    },
  },
});
