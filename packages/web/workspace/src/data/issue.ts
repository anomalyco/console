import type { Issue } from "@console/core/issue/index";
import { Store } from "./store";

export const IssueCountStore = new Store()
  .type<Issue.Count>()
  .scan("forIssue", (issueGroup: string) => [`issueCount`, issueGroup])
  .build();

export const IssueStore = new Store()
  .type<Issue.Info>()
  .scan("forStage", (stageID: string) => ["issue", stageID])
  .get((stageID: string, issueID: string) => ["issue", stageID, issueID])
  .build();
