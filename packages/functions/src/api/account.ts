import { Hono } from "hono";
import { notPublic } from "./auth";
import { assertActor } from "@console/core/actor";
import { Account } from "@console/core/account";

export const AccountRoute = new Hono().use(notPublic).get("/", async (c) => {
  const actor = assertActor("account");
  return c.json({
    id: actor.properties.accountID,
    email: actor.properties.email,
    workspaces: await Account.workspaces(),
  });
});
