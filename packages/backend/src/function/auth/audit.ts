import { AsyncLocalStorage } from "node:async_hooks";

export const auditContext = new AsyncLocalStorage<{
  requestID: string;
  sourceIP?: string;
}>();

export function authAudit(
  action: string,
  result: string,
  identity?: { email?: string; impersonate?: string },
) {
  // Explicit fields only. Never serialize exceptions, requests, claims or tokens.
  console.log(
    JSON.stringify({
      event: "auth",
      ...auditContext.getStore(),
      action,
      result,
      email: identity?.email,
      impersonate: identity?.impersonate || undefined,
    }),
  );
}
