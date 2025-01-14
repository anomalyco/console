import { Hono } from "hono";
import { notPublic } from "./auth";

export const DebugRoute = new Hono().use(notPublic).get("/", async (c) => {});
