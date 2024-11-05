import { auth } from "./auth";
import { database } from "./planetscale";

const websocketAuthorizer = new sst.aws.Function("WebsocketAuthorizer", {
  handler: "packages/functions/src/auth-websocket.handler",
  link: [database, auth],
});

export const websocket = new sst.Linkable("Websocket", {
  properties: {
    http: "oyq6tqbrczd5xfovlyvcsd3xtu.appsync-api.us-east-1.amazonaws.com",
    realtime:
      "oyq6tqbrczd5xfovlyvcsd3xtu.appsync-realtime-api.us-east-1.amazonaws.com",
    token: new sst.Secret("WebsocketToken").value,
  },
});
export {};
