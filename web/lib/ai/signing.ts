import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

export const AI_CONTRACT_VERSION = "v1";
export const AI_SIGNATURE_HEADER = "x-patch-signature";
export const AI_TIMESTAMP_HEADER = "x-patch-timestamp";
export const AI_REQUEST_ID_HEADER = "x-patch-request-id";
export const AI_CONTRACT_VERSION_HEADER = "x-patch-contract-version";

export interface AiRequestSignatureInput {
  secret: string;
  method: string;
  pathname: string;
  body: string;
  requestId?: string;
  timestamp?: number;
}

export interface AiRequestSignature {
  requestId: string;
  timestamp: number;
  signature: string;
}

export function createAiRequestSignature({
  secret,
  method,
  pathname,
  body,
  requestId = randomUUID(),
  timestamp = Math.floor(Date.now() / 1_000),
}: AiRequestSignatureInput): AiRequestSignature {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonicalRequest = [
    AI_CONTRACT_VERSION,
    timestamp,
    requestId,
    method.toUpperCase(),
    pathname,
    bodyHash,
  ].join(".");

  return {
    requestId,
    timestamp,
    signature: `v1=${createHmac("sha256", secret).update(canonicalRequest).digest("hex")}`,
  };
}
