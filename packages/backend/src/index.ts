import { app } from "./api";
import { patchLogger } from "./log-polyfill";

patchLogger();

export default {
  port: 3001,
  fetch: app.fetch,
};
