import { createId } from "@paralleldrive/cuid2";

export const profileID = createId();
/*
import { iot, mqtt } from "aws-iot-device-sdk-v2";
import { onCleanup, onMount } from "solid-js";
import { bus } from "./bus";
import { createId } from "@paralleldrive/cuid2";
import { useDummy } from "./dummy";
import { useAuth2 } from "./auth2";


export function RealtimeProvider() {
  let connection: mqtt.MqttClientConnection;
  const auth = useAuth2();
  const dummy = useDummy();

  onMount(async () => {
    const url = import.meta.env.VITE_IOT_HOST;
    const tokens = auth.all.map((account) => account.token).join(";");

    async function createConnection() {
      if (dummy()) return;
      console.log("creating new connection");
      if (connection) await connection.disconnect();
      const config = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets()
        .with_clean_session(true)
        .with_client_id("client_" + createId())
        .with_endpoint(url)
        .with_custom_authorizer(
          "",
          `${import.meta.env.VITE_STAGE}-console-authorizer`,
          "",
          tokens
        )
        .with_keep_alive_seconds(1200)
        .build();
      const client = new mqtt.MqttClient();
      connection = client.new_connection(config);

      connection.on("connect", async () => {
        console.log("WS connected");
        for (const workspace of auth.all.flatMap((a) => a.workspaces)) {
          console.log("subscribing to", workspace);
          await connection.subscribe(
            `console/${import.meta.env.VITE_STAGE}/${workspace.id}/all/#`,
            mqtt.QoS.AtLeastOnce
          );

          await connection.subscribe(
            `console/${import.meta.env.VITE_STAGE}/${
              workspace.id
            }/${profileID}/#`,
            mqtt.QoS.AtLeastOnce
          );
        }
      });
      connection.on("interrupt", (e) => {
        console.log("interrupted, restarting", e, JSON.stringify(e));
        createConnection();
      });
      connection.on("error", (e) => {
        console.log(
          "connection error",
          e,
          e.error,
          e.name,
          e.cause,
          e.message,
          e.error_code,
          e.error_name
        );
      });
      connection.on("resume", console.log);
      connection.on("message", (fullTopic, payload) => {
        const splits = fullTopic.split("/");
        const workspaceID = splits[2];
        const topic = splits[4];
        const message = new TextDecoder("utf8").decode(new Uint8Array(payload));
        const parsed = JSON.parse(message);
        if (topic === "poke") {
          bus.emit("poke", { workspaceID });
        } else {
          bus.emit(topic as any, parsed.properties);
        }
      });
      connection.on("disconnect", console.log);
      await connection.connect();
    }

    createConnection();
  });

  onCleanup(() => {
    if (connection) connection.disconnect();
  });

  return null;
}
*/
