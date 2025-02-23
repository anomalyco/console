import { postgres } from "@console/core/drizzle/postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export const handler = async (event: any) => {
  await migrate(postgres, {
    migrationsFolder: "./migrations-pg",
  });
};
