// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client } from "../lib/storage/r2";

describe("R2 signed source host", () => {
  it("keeps upload and download on the configured exact allowlisted endpoint", async () => {
    const endpoint = "https://fixture.r2.cloudflarestorage.com";
    const client = createR2Client({
      R2_REGION: "auto",
      R2_ENDPOINT: endpoint,
      R2_ACCESS_KEY_ID: "fixture-only",
      R2_SECRET_ACCESS_KEY: "fixture-only",
    });
    const input = {
      Bucket: "synthetic-fixture",
      Key: "originals/test-card.txt",
    };
    const signed = await Promise.all([
      getSignedUrl(client, new GetObjectCommand(input), { expiresIn: 60 }),
      getSignedUrl(client, new PutObjectCommand(input), { expiresIn: 60 }),
    ]);
    for (const value of signed) {
      const url = new URL(value);
      expect(url.origin).toBe(endpoint);
      expect(url.pathname).toBe("/synthetic-fixture/originals/test-card.txt");
    }
    client.destroy();
  });
});
