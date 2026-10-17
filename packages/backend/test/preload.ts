import { mock } from "bun:test";

// Every Resource.<Name>.<prop> resolves to a deterministic fake value so modules
// can load without a linked SST stage.
const Resource = new Proxy(
  {},
  {
    get: (_, name) =>
      new Proxy(
        {},
        {
          get: (_, prop) =>
            name === "Bus" && prop === "arn"
              ? "arn:aws:events:us-east-1:999999999999:event-bus/test"
              : prop === "stage"
                ? "test"
                : `test-${String(name)}-${String(prop)}`,
        },
      ),
  },
);
mock.module("sst", () => ({ Resource }));

export const published: { type: string; properties: any }[] = [];
mock.module("sst/aws/bus", () => ({
  bus: {
    subscriber:
      (_events: unknown, callback: (event: any, raw: any) => any) =>
      (raw: any) =>
        callback(
          {
            type: raw["detail-type"],
            properties: raw.detail.properties,
            metadata: raw.detail.metadata,
          },
          raw,
        ),
    publish: async (_bus: unknown, def: { type: string }, properties: any) => {
      published.push({ type: def.type, properties });
    },
  },
}));

// Fake database: every select pops the next queued result, writes are recorded.
export const fake = {
  sql: undefined as any,
  selects: [] as any[][],
  writes: [] as { op: string; values?: any }[],
  reset() {
    fake.sql = undefined;
    fake.selects = [];
    fake.writes = [];
  },
};

function chain(
  result: () => any,
  record?: (method: string, args: any[]) => void,
) {
  const proxy: any = new Proxy(function () {}, {
    get(_, prop) {
      if (prop === "then") {
        const promise = Promise.resolve().then(result);
        return promise.then.bind(promise);
      }
      if (prop === "execute") return () => Promise.resolve().then(result);
      return (...args: any[]) => {
        record?.(String(prop), args);
        return proxy;
      };
    },
  });
  return proxy;
}

function write(op: string) {
  const entry: { op: string; values?: any } = { op };
  fake.writes.push(entry);
  return chain(
    () => ({ rowsAffected: 1 }),
    (method, args) => {
      if (method === "values" || method === "set") entry.values = args[0];
    },
  );
}

export const fakeTx: any = {
  select: (...args: any[]) => {
    if (fake.sql) return fake.sql.select(...args);
    const rows = fake.selects.shift() ?? [];
    return chain(() => rows);
  },
  insert: (...args: any[]) =>
    fake.sql ? fake.sql.insert(...args) : write("insert"),
  update: (...args: any[]) =>
    fake.sql ? fake.sql.update(...args) : write("update"),
  delete: (...args: any[]) =>
    fake.sql ? fake.sql.delete(...args) : write("delete"),
  transaction: (cb: (tx: any) => any) => cb(fakeTx),
};

const drizzle = await import("drizzle-orm");
const mysql = await import("drizzle-orm/mysql-core");
mock.module("@console/core/drizzle/index", () => ({
  ...drizzle,
  MySqlColumn: mysql.MySqlColumn,
  db: fakeTx,
}));

mock.module("@console/core/util/transaction", () => ({
  useTransaction: (cb: (tx: any) => any) => cb(fakeTx),
  createTransaction: (cb: (tx: any) => any) => cb(fakeTx),
  createTransactionEffect: async (effect: () => any) => effect(),
}));

export const tokens = new Map<string, { accountID: string; email: string }>();
mock.module("@openauthjs/openauth/client", () => ({
  createClient: () => ({
    verify: async (token: string) => {
      const properties = tokens.get(token);
      if (!properties) return { err: new Error("invalid token") };
      return { subject: { type: "account", properties } };
    },
  }),
}));

mock.module("@console/core/replicache/index", () => ({
  Replicache: {
    poke: async () => {},
    CVR: { get: async () => undefined, put: async () => {} },
  },
}));

export const undiciCalls: { url: string; init?: any }[] = [];
const undici = { ...(await import("undici")) };
mock.module("undici", () => ({
  ...undici,
  fetch: async (url: string, init?: any) => {
    undiciCalls.push({ url: String(url), init });
    return new Response("ok");
  },
}));
