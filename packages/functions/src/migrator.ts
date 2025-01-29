import { postgres } from "@console/core/drizzle/index";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export const handler = async (event: any) => {
  await migrate(postgres, {
    migrationsFolder: "./migrations-pg",
  });
};
