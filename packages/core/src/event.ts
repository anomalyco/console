import { event as sstEvent } from "sst/event";
import { ZodValidator } from "sst/event/validator";
import { useActor } from "./actor";

export const createEvent = sstEvent.builder({
  validator: ZodValidator,
  metadata() {
    return {
      actor: useActor(),
    };
  },
});

import { openevent } from "@openauthjs/openevent/event";
export { publish } from "@openauthjs/openevent/publisher/drizzle";

export const event = openevent({
  metadata() {
    return {
      actor: useActor(),
    };
  },
});
