export * as Replicache from ".";
import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Realtime } from "../realtime";
import { compress, decompress } from "../util/compress";
import { Resource } from "sst";

export async function poke(profileID?: string) {
  console.log("sending poke");
  await Realtime.publish("poke", {});
  console.log("poke sent");
}

const s3 = new S3Client({});
export module CVR {
  interface Info {
    data: Record<string, number>;
    clientVersion: number;
  }

  export async function key(clientGroupID: string, cookie: number) {
    return (
      ["temporary", "weekly", "cvr", clientGroupID, (cookie as number) || 0]
        .map((x) => x.toString())
        .join("/") + ".gz"
    );
  }

  export async function get(clientGroupID: string, cookie: number) {
    const path = key(clientGroupID, cookie);
    const result = await s3
      .send(
        new GetObjectCommand({
          Bucket: Resource.Storage.name,
          Key: await path,
        }),
      )
      .catch((e) => {
        if (e instanceof NoSuchKey) return;
        throw e;
      });
    if (!result) return;
    const data = await decompress(await result.Body!.transformToByteArray()!);
    return JSON.parse(data.toString()) as Info;
  }

  export async function put(clientGroupID: string, version: number, cvr: Info) {
    const path = await key(clientGroupID, version);
    await s3.send(
      new PutObjectCommand({
        Bucket: Resource.Storage.name,
        Key: path,
        ContentEncoding: "gzip",
        ContentType: "application/json",
        Body: await compress(JSON.stringify(cvr)),
      }),
    );
  }
}
