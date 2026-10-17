import { eventBusPolicy } from "./event-policy";

export const bus = new sst.aws.Bus("Bus");

new aws.cloudwatch.EventBusPolicy("BusPolicy", {
  eventBusName: bus.name,
  policy: bus.nodes.bus.arn.apply((arn) =>
    JSON.stringify(eventBusPolicy(arn, $app.stage)),
  ),
});
