# Issuer protections

Email issuance and verification are enforced inside the issuer, including calls
to its public Lambda URL. These controls do not depend on edge rules, browser
cookies for counters, or Lambda concurrency. They are not multi-factor authentication.

## Policy and persistence

One DynamoDB transaction reserves all send budgets **before** calling the mail
provider and replaces the current challenge for the same normalized email,
server-generated flow ID and impersonation target. It contains:

- A per-email cooldown conditional update (default 60 seconds).
- A per-email UTC-hour counter (default 10).
- Global UTC-minute/hour counters (defaults 20 / 120).
- The active flow's challenge ID, normalized email, flow ID, impersonation target,
  authorization-state digest and 600-second expiry. No raw code is stored in DynamoDB.

The existing OpenAuth table/key layout and `expiry` TTL attribute are reused;
there is no database migration. New key prefixes do not collide with OAuth keys
or the previous challenge namespace. Counters have bounded TTLs; conditions and
window keys enforce expiration without waiting for asynchronous TTL cleanup.
Use a single regional table shared by all issuer instances; DynamoDB global-table
replication is not a substitute for regional transaction serialization.

Conditional budget rejection returns 429 and sends nothing. Transaction conflicts,
capacity/IAM/network failures return 503 and send nothing. SDK retries reuse the
transaction's idempotency key. An ambiguous transaction outcome never authorizes
a send. Mail failures are not refunded (the provider may already have accepted
the message); they return a generic 503 without logging the exception or message.

The six-digit code remains only in OpenAuth's authenticated-encrypted, HttpOnly
provider cookie, now limited to 600 seconds. Verification conditionally deletes
the server record **before** comparing the code. Every binding and expiry must
match. Only one concurrent verification can consume a challenge, including wrong
guesses. A saved cookie does not restore a consumed or superseded challenge.

## Resend and denial-of-service tradeoffs

Issuance requires authenticated-encrypted OAuth authorization state; requests
without it cannot reserve budgets or send mail. Resend also requires the existing
encrypted provider state and cannot retarget its
email/impersonation/OAuth authorization. A new request with the same state/email/
target also replaces the old challenge. Requests with no existing state create a
new server-generated flow; independent browser sessions do not invalidate each
other's codes. A new OAuth authorization is a separate flow. Form-supplied flow
and challenge IDs are ignored. All flows share per-email and global budgets.

Rejected resends neither replace the active challenge nor clear its cookie, so
an existing legitimate code remains usable. Issuance and consumption serialize
at the active-flow item: an old verification which wins before a replacement may
complete; after replacement it cannot. A mail failure after replacement leaves
the previous code invalid. This is deliberate fail-closed behavior.

An attacker can still exhaust a victim's send budget to delay **new** codes, or
exhaust the global budget to delay new email logins. They cannot invalidate a code
in an independent flow by doing so. These are hard caps, not a complete denial-of-
service solution. Google sign-in is not charged to email budgets. A stronger
admission system (trusted-origin limits, abuse challenges, provider/edge defense)
can reduce budget exhaustion, but must not replace issuer enforcement. There is
no trustworthy end-user origin IP at this boundary behind the CDN: no IP budget
uses supplied X-Forwarded-For. Audit `sourceIP` is only the AWS transport peer,
which may be the CDN, never a claim of end-user attribution.

Hour/minute counters use fixed UTC windows, not a rolling token bucket. Adjacent
windows can allow a boundary burst; the email cooldown still prevents sub-minute
sends. Limits count attempts reserved for sending, including failures and codes
already consumed, not just successful sign-ins.

## Refresh and impersonation

The pinned OpenAuth release has no refresh lifecycle hook. The checked-in patch
adds a schema-validated `refresh` callback before refresh rotation, reuse handling
and token issuance. It rejects invalid stored subjects and removes the presented
refresh record on authorization denial, without deleting independently verified
sessions for the same account. Storage/DB failures fail closed. Both first-use
refreshes and requests inside the reuse interval take this path.

The callback reuses `Account.authorize` / `Account.authorizeUser`, not a duplicate
account schema or deletion query. Account identity must still exist and be live;
user subjects also require live workspace membership, workspace and account.
There is no separate disabled flag in the current schema; `timeDeleted` and
missing records are the existing revocation states. API live-authorization checks
remain necessary: this change does not revoke already-issued access tokens by itself.

The existing staff allowlist and impersonation feature remain. New impersonated
account subjects include optional provenance (staff identity, workspace and target
membership); refresh rechecks both principals, the allowlist and the intended live
membership/workspace. This is provenance, not a multi-factor claim. New account
sessions carry an issuer-owned authentication marker (`email`, `google` or
`impersonation`). Impersonation markers require provenance; normal markers must
not contain it. Refresh rotation retains the marker and rechecks live authorization.

Legacy account refreshes without the marker cannot be distinguished safely from
old impersonated sessions and are rejected on use, requiring a one-time sign-in.
They are not guessed to be normal and cannot mint a verified marker through refresh.
Rejecting one does not revoke a separate newly verified session for the same account.
Existing user-subject refreshes continue to require live workspace membership and
account checks; the account-only migration does not silently revoke them. The
marker remains optional when decoding access tokens for compatibility. Existing
access tokens retain their original expiry (the previous default was 30 days),
so this refresh migration is not retroactive access-token revocation. API live
account/membership checks remain necessary.

## Safe audit

Structured `auth` events allowlist request ID, transport peer IP, action, result,
normalized email when known, and impersonation target when applicable. They never
serialize code/token/cookie/form/OAuth payload/exception objects. The pinned patch
removes OpenAuth's URL logger and raw exception/decryption logging; the application
returns generic failures. `verify/success` means code verification only; `login`
records the subsequent account authorization result. `refresh` records live subject
authorization; the HTTP completion event also covers malformed requests or invalid
refresh tokens which never reach that hook. Restrict log access and retention since
email/impersonation metadata is personal data.

## Rollout configuration

The review-only deployment guard has been removed. Automatic branch/PR targets
retain their normal stage naming; branch removals and tags retain their default
skip behavior. A commit whose message includes `[manual rollout]` opts out of
automation. Use that marker in the merge-commit subject when deployment must be
performed manually from the exact reviewed merge commit, preventing duplicate runs.

Configure deployment environment variables (forwarded explicitly by `infra/auth.ts`):

| Variable                      | Default | Meaning                                               |
| ----------------------------- | ------- | ----------------------------------------------------- |
| `AUTH_EMAIL_COOLDOWN_SECONDS` | `60`    | Minimum seconds between sends to one normalized email |
| `AUTH_EMAIL_HOURLY_LIMIT`     | `10`    | Reserved sends/email/UTC hour                         |
| `AUTH_GLOBAL_MINUTE_LIMIT`    | `20`    | Reserved sends/UTC minute across all emails           |
| `AUTH_GLOBAL_HOURLY_LIMIT`    | `120`   | Reserved sends/UTC hour across all emails             |

All values must be positive integers; invalid configuration prevents startup.
Defaults are based on a complete representative 15-day auth-mail metadata cohort,
filtered by exact sender and auth subject prefix, including failed/suppressed
attempts rather than only delivery successes. No message bodies, code values or
recipient identities are published. Observed peaks were 2/global UTC minute,
3/global rolling minute, 12/global UTC hour and 7/email UTC hour (8/rolling hour).
Global limits provide 10x fixed-window headroom (at least 6.6x rolling-minute
headroom); the email cap includes the observed retry peak with headroom. This is
capacity allowance, not a growth forecast or an inference from HTTP invocations.
Revisit it as normal send volumes grow, using issuance/send data rather than total
issuer requests. A cap set too low becomes a service-wide login denial mechanism.

The 60-second cooldown intentionally trades retry speed for a smaller guessing
budget: some historically adjacent requests were under 60 seconds. A throttled
resend keeps the outstanding code usable; a consumed wrong guess must wait for
the next send slot. Hard caps also limit mail cost and are not a substitute for
separate admission/abuse protection. No provider-quota increase is required.

Verify the issuer role permits the transaction's PutItem/UpdateItem operations
and conditional DeleteItem on the existing regional auth table, and TTL is enabled
on `expiry`. Exercise the pinned patch through the actual packaged Lambda build;
do not upgrade OpenAuth or drop the patch without the refresh regression tests.
Monitor 429 vs 503, send success vs verification/login success, transaction conflicts
and mail failures; global counter contention can yield conservative 503s even with
unused budget. No live concurrency setting changes are needed by this patch.

In-flight legacy provider cookies do not have the new binding fields and must
restart login. Unverifiable legacy account refreshes require a one-time sign-in;
newly verified normal and deliberate impersonated sessions continue to rotate.
A rollback
to the old issuer also removes these protections and must be reviewed accordingly.

## Verification

Use the repository-pinned Bun 1.2.1 and frozen lockfile. The repository has no
aggregate `check` script; `bun run typecheck` is the full existing typecheck task.
Run backend tests from `packages/backend` so `bunfig.toml` loads the isolated SST,
database and external-service fixtures.

The DynamoDB tests are opt-in and require a disposable **local** DynamoDB instance:

```sh
docker run --rm -p 127.0.0.1:18943:8000 amazon/dynamodb-local:3.3.0 -jar DynamoDBLocal.jar -inMemory -sharedDb
# In another terminal, from packages/backend:
AUTH_TEST_DYNAMO_ENDPOINT=http://127.0.0.1:18943 bun test
```

They create/delete only a uniquely named local table, reject non-loopback endpoints,
and exercise real conditional expressions and transactions across independent SDK
clients. Without that environment variable, the integration suite is explicitly
skipped. No test sends real mail or contacts production AWS.
