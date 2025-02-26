const SAMPLE = [
  `INIT_START Runtime Version: nodejs:20.v51	Runtime Version ARN: arn:aws:lambda:us-east-1::runtime:cb6527bfb6726a080a367eca00e49765ca5abd8cd1a17783fbee683313121ece`,
  `START RequestId: 2307132f-9014-403c-ba61-9b6c487af6f1 Version: $LATEST`,
  `2025-01-20T19:35:50.484Z	2307132f-9014-403c-ba61-9b6c487af6f1	INFO	starting 2025-01-20T19:35:50.484Z`,
  `2025-01-20T19:35:50.488Z	2307132f-9014-403c-ba61-9b6c487af6f1	ERROR	Error: logged a different error
    at Runtime.handler (file:///var/task/bundle.mjs:13:17)
    at Runtime.handleOnceNonStreaming (file:///var/runtime/index.mjs:1173:29)`,
  `END RequestId: 2307132f-9014-403c-ba61-9b6c487af6f1`,
  `REPORT RequestId: 2307132f-9014-403c-ba61-9b6c487af6f1	Duration: 8.83 ms	Billed Duration: 9 ms	Memory Size: 1024 MB	Max Memory Used: 65 MB	Init Duration: 138.10 ms	`,
  `START RequestId: 9da0a08b-1f13-4594-bca7-86fad8da42f0 Version: $LATEST`,
  `2025-01-20T19:35:50.661Z	9da0a08b-1f13-4594-bca7-86fad8da42f0	INFO	starting 2025-01-20T19:35:50.661Z`,
  `2025-01-20T19:35:50.661Z	9da0a08b-1f13-4594-bca7-86fad8da42f0	ERROR	Error: logged a different error
    at Runtime.handler (file:///var/task/bundle.mjs:13:17)
    at Runtime.handleOnceNonStreaming (file:///var/runtime/index.mjs:1173:29)`,
  `END RequestId: 9da0a08b-1f13-4594-bca7-86fad8da42f0`,
  `REPORT RequestId: 9da0a08b-1f13-4594-bca7-86fad8da42f0	Duration: 1.95 ms	Billed Duration: 2 ms	Memory Size: 1024 MB	Max Memory Used: 65 MB	`,
  `START RequestId: ffa301c2-4df2-4590-9bbb-c59b6be49cee Version: $LATEST`,
  `2025-01-20T19:35:51.076Z	ffa301c2-4df2-4590-9bbb-c59b6be49cee	INFO	starting 2025-01-20T19:35:51.076Z`,
  `2025-01-20T19:35:51.076Z	ffa301c2-4df2-4590-9bbb-c59b6be49cee	ERROR	Error: logged a different error
    at Runtime.handler (file:///var/task/bundle.mjs:13:17)
    at Runtime.handleOnceNonStreaming (file:///var/runtime/index.mjs:1173:29)`,
  `END RequestId: ffa301c2-4df2-4590-9bbb-c59b6be49cee`,
  `REPORT RequestId: ffa301c2-4df2-4590-9bbb-c59b6be49cee	Duration: 2.02 ms	Billed Duration: 3 ms	Memory Size: 1024 MB	Max Memory Used: 65 MB	`,
  `START RequestId: 53512bb9-ab05-4233-953c-ddd0d0c7084a Version: $LATEST`,
  `2025-01-20T19:35:51.217Z	53512bb9-ab05-4233-953c-ddd0d0c7084a	INFO	starting 2025-01-20T19:35:51.216Z`,
  `2025-01-20T19:35:51.217Z	53512bb9-ab05-4233-953c-ddd0d0c7084a	ERROR	Error: logged a different error
    at Runtime.handler (file:///var/task/bundle.mjs:13:17)
    at Runtime.handleOnceNonStreaming (file:///var/runtime/index.mjs:1173:29)`,
  `END RequestId: 53512bb9-ab05-4233-953c-ddd0d0c7084a`,
  `REPORT RequestId: 53512bb9-ab05-4233-953c-ddd0d0c7084a	Duration: 2.07 ms	Billed Duration: 3 ms	Memory Size: 1024 MB	Max Memory Used: 65 MB	`,
  `2025-01-20T19:35:51.463Z	8c29efea-a156-4ef4-92d1-f8a30110af75	INFO	starting 2025-01-20T19:35:51.463Z`,
  `START RequestId: 8c29efea-a156-4ef4-92d1-f8a30110af75 Version: $LATEST`,
  `2025-01-20T19:35:51.464Z	8c29efea-a156-4ef4-92d1-f8a30110af75	ERROR	Error: logged a different error
    at Runtime.handler (file:///var/task/bundle.mjs:13:17)
    at Runtime.handleOnceNonStreaming (file:///var/runtime/index.mjs:1173:29)`,
  `2025-02-26T06:23:50.811Z	00000000-0000-0000-0000-000000000000	ERROR	Error: test
    at <anonymous> (/home/bun/app/packages/backend/src/api/index.ts:74:23)
    at <anonymous> (/home/bun/app/packages/backend/src/api/index.ts:73:25)
    at <anonymous> (/home/bun/app/node_modules/hono/dist/compose.js:29:23)
    at dispatch (/home/bun/app/node_modules/hono/dist/compose.js:7:32)
    at run (node:async_hooks:64:22)
    at auth (/home/bun/app/packages/backend/src/api/auth.ts:22:47)
    at <anonymous> (/home/bun/app/node_modules/hono/dist/compose.js:29:23)
    at dispatch (/home/bun/app/node_modules/hono/dist/compose.js:7:32)
    at <anonymous> (/home/bun/app/packages/backend/src/api/index.ts:26:15)
    at <anonymous> (/home/bun/app/node_modules/hono/dist/compose.js:29:23)`,
  `END RequestId: 8c29efea-a156-4ef4-92d1-f8a30110af75`,
  `REPORT RequestId: 8c29efea-a156-4ef4-92d1-f8a30110af75	Duration: 1.91 ms	Billed Duration: 2 ms	Memory Size: 1024 MB	Max Memory Used: 65 MB`,
];

import { test, expect } from "bun:test";
import { LambdaGrouper } from "../../src/log/lambda";

test("invocation", () => {
  const grouper = LambdaGrouper();
  const result = SAMPLE.flatMap((item, index) =>
    grouper.process({
      id: index.toString(),
      line: item,
      timestamp: 0,
      stream: "default",
    }),
  );
  expect(result).toMatchSnapshot();
});
