import { Issue } from "@console/core/issue/index";
import { Log } from "@console/core/log/index";

export async function handler() {
  await Issue.cleanup();
  await Log.Search.cleanup();
}
