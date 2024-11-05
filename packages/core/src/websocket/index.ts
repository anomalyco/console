import { Resource } from "sst";
import { useWorkspace } from "../actor";

export namespace Websocket {
  export async function publish(type: string, properties: Record<string, any>) {
    const event = {
      type,
      properties: {
        ...properties,
        workspaceID: useWorkspace(),
      },
    };
    const channel = `/workspace/${event.properties.workspaceID}`;
    const body = JSON.stringify({
      channel,
      events: [JSON.stringify(event)],
    });
    await fetch("https://" + Resource.Websocket.http + "/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Resource.Websocket.token,
      },
      body,
    });
  }
}
