import { test, expect } from "bun:test";
import { LogError } from "../../src/log/error";

test("container error", () => {
  const msg = `2025-02-26T16:52:16.348Z	00000000-0000-0000-0000-000000000000	ERROR	Error: test
    at <anonymous> (/home/bun/app/packages/backend/src/api/index.ts:74:23)
    at <anonymous> (/home/bun/app/packages/backend/src/api/index.ts:73:25)
    at <anonymous> (/home/bun/app/node_modules/hono/dist/compose.js:29:23)
    at dispatch (/home/bun/app/node_modules/hono/dist/compose.js:7:32)
    at run (node:async_hooks:64:22)
    at auth (/home/bun/app/packages/backend/src/api/auth.ts:22:47)
    at <anonymous> (/home/bun/app/node_modules/hono/dist/compose.js:29:23)
    at dispatch (/home/bun/app/node_modules/hono/dist/compose.js:7:32)
    at <anonymous> (/home/bun/app/packages/backend/src/api/index.ts:26:15)
    at <anonymous> (/home/bun/app/node_modules/hono/dist/compose.js:29:23)`;
  const error = LogError.extract(msg);

  expect(error).toBeDefined();
  expect(error).toMatchSnapshot();
});
