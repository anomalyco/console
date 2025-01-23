import { db, inArray, or } from "@console/core/drizzle/index";
import { workspace } from "@console/core/workspace/workspace.sql";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export function prompt(question: string) {
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function promptWorkspaces() {
  const workspaceFilter: string[] = await prompt("workspaces: ").then((x) =>
    x.split(" ").filter(Boolean),
  );

  const results = await db
    .select({
      workspaceID: workspace.id,
      slug: workspace.slug,
    })
    .from(workspace)
    .where(
      or(
        inArray(workspace.slug, workspaceFilter),
        inArray(workspace.id, workspaceFilter),
      ),
    )
    .execute();

  console.log(
    "found:",
    results.map((x) => x.slug),
  );

  return results.map((x) => x.workspaceID);
}
