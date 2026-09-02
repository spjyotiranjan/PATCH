import "server-only";

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

import type { ServerConfig } from "@/lib/config";

export function createR2Client(
  config: Pick<
    ServerConfig,
    "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_ENDPOINT" | "R2_REGION"
  >,
): S3Client {
  return new S3Client({
    region: config.R2_REGION,
    endpoint: config.R2_ENDPOINT,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function checkR2Readiness(
  config: Pick<
    ServerConfig,
    | "R2_ACCESS_KEY_ID"
    | "R2_SECRET_ACCESS_KEY"
    | "R2_ENDPOINT"
    | "R2_REGION"
    | "R2_BUCKET_NAME"
  >,
): Promise<{ status: "ready" | "unavailable" }> {
  try {
    await createR2Client(config).send(
      new HeadBucketCommand({ Bucket: config.R2_BUCKET_NAME }),
    );
    return { status: "ready" };
  } catch {
    return { status: "unavailable" };
  }
}
