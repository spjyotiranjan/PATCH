import "server-only";

import {
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ServerConfig } from "@/lib/config";

export async function storeVisualDerivative(
  config: ServerConfig,
  key: string,
  png: Buffer,
) {
  // The key includes the SHA-256 verified by Web; retries write identical bytes.
  await createR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: key,
      Body: png,
      ContentType: "image/png",
      ContentLength: png.length,
      CacheControl: "private, no-store",
    }),
  );
}

export async function storeProcedureExport(
  config: ServerConfig,
  key: string,
  content: string,
) {
  // Content-addressed immutable snapshots: retries can only write identical bytes.
  await createR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: "text/plain",
    }),
  );
}

export async function uploadUrl(
  config: ServerConfig,
  key: string,
  contentType: string,
  bytes: number,
) {
  return getSignedUrl(
    createR2Client(config),
    new PutObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: bytes,
    }),
    { expiresIn: config.R2_PRESIGNED_URL_TTL_SECONDS },
  );
}
export async function sourceUrl(
  config: ServerConfig,
  key: string,
  download = false,
) {
  return getSignedUrl(
    createR2Client(config),
    new GetObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: download ? "attachment" : "inline",
    }),
    { expiresIn: Math.min(config.R2_PRESIGNED_URL_TTL_SECONDS, 300) },
  );
}
export async function finalizeUpload(
  config: ServerConfig,
  stagingKey: string,
  finalKey: string,
  bytes: number,
  contentType: string,
) {
  const client = createR2Client(config);
  const head = await client.send(
    new HeadObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: stagingKey }),
  );
  if (
    head.ContentLength !== bytes ||
    head.ContentType !== contentType ||
    !head.ETag
  )
    throw new Error("UPLOAD_MISMATCH");
  // Signed PUTs can be replayed until expiry. Copy the reviewed ETag to a key
  // that has never been exposed for upload; AI verifies its SHA-256 separately.
  await client.send(
    new CopyObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: finalKey,
      CopySource: `${config.R2_BUCKET_NAME}/${stagingKey}`,
      CopySourceIfMatch: head.ETag,
      MetadataDirective: "COPY",
    }),
  );
}

export function createR2Client(
  config: Pick<
    ServerConfig,
    "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_ENDPOINT" | "R2_REGION"
  >,
): S3Client {
  return new S3Client({
    region: config.R2_REGION,
    endpoint: config.R2_ENDPOINT,
    // Keep signed source hosts identical to the documented exact AI allowlist.
    // The bucket remains in the path, not an SDK-invented hostname prefix.
    forcePathStyle: true,
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
