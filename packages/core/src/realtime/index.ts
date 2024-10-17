export * as Realtime from ".";
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { useWorkspace } from "../actor";
import { Resource } from "sst";

const data = new IoTDataPlaneClient({});

export async function publish(
  topic: string,
  properties: any,
  profileID?: string,
) {
  const workspaceID = useWorkspace();
  await data.send(
    new PublishCommand({
      payload: Buffer.from(
        JSON.stringify({
          properties,
          workspaceID,
        }),
      ),
      topic: `console/${Resource.App.stage}/${workspaceID}/${
        profileID ? profileID : "all"
      }/${topic}`,
    }),
  );
}
