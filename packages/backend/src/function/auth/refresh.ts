import type { SubjectPayload } from "@openauthjs/openauth/subject";
import { Account } from "@console/core/account/index";
import type { subjects } from "../../subjects";
import { authAudit } from "./audit";
import { staffEmails } from "./impersonation";

// The pinned OpenAuth patch schema-validates before invoking this hook and
// invokes it before ANY refresh rotation/reuse handling or token generation.
export async function authorizeRefresh(
  subject: SubjectPayload<typeof subjects>,
) {
  let allowed =
    subject.type === "account"
      ? !!(await Account.authorize(subject.properties))
      : !!(await Account.authorizeUser(
          subject.properties.userID,
          subject.properties.workspaceID,
        ));
  const impersonation =
    subject.type === "account" ? subject.properties.impersonation : undefined;
  if (allowed && impersonation && subject.type === "account") {
    allowed =
      staffEmails.includes(impersonation.email) &&
      !!(await Account.authorize(impersonation)) &&
      !!(await Account.authorize(
        subject.properties,
        impersonation.workspaceID,
      )) &&
      !!(await Account.authorizeUser(
        impersonation.userID,
        impersonation.workspaceID,
      ));
  }
  authAudit(
    "refresh",
    allowed ? "success" : "denied",
    subject.type === "account"
      ? {
          email: subject.properties.email,
          impersonate: impersonation?.workspaceID,
        }
      : undefined,
  );
  return allowed;
}
