import {
  MySqlTransaction,
  MySqlTransactionConfig,
} from "drizzle-orm/mysql-core";
import {
  PlanetScalePreparedQueryHKT,
  PlanetscaleQueryResultHKT,
} from "drizzle-orm/planetscale-serverless";
import { db } from "../drizzle";
import { ExtractTablesWithRelations } from "drizzle-orm";
import { createContext } from "../context";
import { DatabaseError } from "@planetscale/database";

export type Transaction = MySqlTransaction<
  PlanetscaleQueryResultHKT,
  PlanetScalePreparedQueryHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

export type TxOrDb = Transaction | typeof db;

const TransactionContext = createContext<{
  tx: TxOrDb;
  effects: (() => void | Promise<void>)[];
}>("TransactionContext");

export async function useTransaction<T>(callback: (trx: TxOrDb) => Promise<T>) {
  try {
    const { tx } = TransactionContext.use();
    return callback(tx);
  } catch {
    return callback(db);
  }
}

export async function createTransactionEffect(
  effect: () => any | Promise<any>,
) {
  try {
    const { effects } = TransactionContext.use();
    effects.push(effect);
  } catch {
    await effect();
  }
}

export async function createTransaction<T>(
  callback: (tx: TxOrDb) => Promise<T>,
  config?: MySqlTransactionConfig,
) {
  try {
    const { tx } = TransactionContext.use();
    return callback(tx);
  } catch {
    let i = 0;
    while (true) {
      i++;
      const effects: (() => void | Promise<void>)[] = [];
      try {
        const result = await db.transaction(
          async (tx) => {
            const result = await TransactionContext.with(
              { tx, effects },
              async () => {
                return callback(tx);
              },
            );
            return result;
          },
          {
            isolationLevel: "repeatable read",
            ...config,
          },
        );
        await Promise.all(effects.map((x) => x()));
        return result;
      } catch (ex: any) {
        if (
          i < 3 &&
          ex instanceof DatabaseError &&
          ex.message.includes("try restarting transaction")
        ) {
          console.log("deadlock detected, retrying", i);
          continue;
        }
        throw ex;
      }
    }
  }
}
