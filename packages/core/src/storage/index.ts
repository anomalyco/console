export * as Storage from "./index";

import {
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { compress } from "../util/compress";
import { Resource } from "sst";

const s3 = new S3Client({});
export async function putEphemeral(
  body: string,
  options?: Omit<
    PutObjectCommandInput,
    "Body" | "Key" | "Bucket" | "ContentEncoding"
  >,
) {
  const key = `ephemeral/${createId()}`;

  await s3.send(
    new PutObjectCommand({
      Key: key,
      Bucket: Resource.Storage.name,
      ContentEncoding: "gzip",
      Body: await compress(body),
      ...options,
    }),
  );

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: Resource.Storage.name,
      Key: key,
    }),
  );

  return url;
}
