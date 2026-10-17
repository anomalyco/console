import { createHmac, timingSafeEqual } from "node:crypto";

export interface StatePayload {
  workspaceID: string;
  nonce?: string;
}

const TTL = 60 * 60 * 1000;

function signature(secret: string, purpose: string, body: string) {
  return createHmac("sha256", `${purpose}:${secret}`)
    .update(body)
    .digest("base64url");
}

export function signState(
  secret: string,
  purpose: string,
  payload: StatePayload,
) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + TTL }),
  ).toString("base64url");
  return `${body}.${signature(secret, purpose, body)}`;
}

export function verifyState(
  secret: string,
  purpose: string,
  state: string,
): StatePayload | undefined {
  const [body, sig] = state.split(".");
  if (!body || !sig) return;
  const expected = Buffer.from(signature(secret, purpose, body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return;
  if (!timingSafeEqual(expected, actual)) return;
  const parsed: StatePayload & { exp: number } = JSON.parse(
    Buffer.from(body, "base64url").toString(),
  );
  if (parsed.exp < Date.now()) return;
  return { workspaceID: parsed.workspaceID, nonce: parsed.nonce };
}
