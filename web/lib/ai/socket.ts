import "server-only";
import WebSocket from "ws";
import { context, propagation } from "@opentelemetry/api";
import { z } from "zod";
import type { ServerConfig } from "@/lib/config";
import type { Schema } from "@/lib/backend/models";
import { createAiRequestSignature } from "./signing";

export const citationSchema = z.object({
  id: z.string().min(1).max(200),
  documentId: z.string().nullable().default(null),
  chunkId: z.string().nullable().default(null),
  documentVersionId: z.string(),
  documentTitle: z.string().nullable().default(null),
  revision: z.string().nullable().default(null),
  page: z.number().int().positive().nullable().default(null),
  section: z.string().nullable().default(null),
  excerpt: z.string().min(1).max(4000),
  approvalState: z.literal("APPROVED").nullable().default(null),
});
export const answerSchema = z.object({
  requestId: z.string().uuid(),
  chatSession: z.object({
    id: z.string(),
    suggestedTitle: z.string().max(100),
  }),
  turnId: z.string(),
  status: z.enum([
    "approved",
    "incomplete",
    "conflicting",
    "outdated",
    "unavailable",
  ]),
  routing: z.object({
    selectedEntities: z
      .array(
        z.object({
          type: z.enum(["EQUIPMENT", "PROJECT"]),
          id: z.string(),
          reason: z.string().max(1000),
        }),
      )
      .max(50)
      .default([]),
    usedStructuralFallback: z.boolean(),
    profileVersions: z.array(z.number().int()).max(500).default([]),
  }),
  answer: z.object({
    summary: z.string().nullable().default(null),
    steps: z
      .array(
        z.object({
          id: z.string(),
          text: z.string().max(4000),
          citationIds: z.array(z.string()).max(8),
        }),
      )
      .max(20)
      .default([]),
  }),
  citations: z.array(citationSchema).max(50).default([]),
  warnings: z.array(z.string().max(1000)).max(20).default([]),
  followUpAllowed: z.boolean(),
  visualEvidenceState: z
    .enum(["TEXT_ONLY", "AVAILABLE", "UNAVAILABLE"])
    .default("TEXT_ONLY"),
  visualCitations: z
    .array(
      z
        .object({
          id: z.string().min(1).max(200),
          assetId: z.string().regex(/^[a-f0-9]{24}$/),
          documentId: z.string(),
          documentVersionId: z.string(),
          page: z.number().int().min(1).max(500),
          bounds: z
            .object({
              left: z.number().min(0).max(1),
              top: z.number().min(0).max(1),
              right: z.number().min(0).max(1),
              bottom: z.number().min(0).max(1),
            })
            .strict(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          descriptionFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
          visualClass: z.enum([
            "SCHEMATIC",
            "DIAGRAM",
            "CHART",
            "TABLE",
            "PHOTO",
            "SCREENSHOT",
            "OTHER",
          ]),
          relevanceRole: z.enum(["REQUIRED", "HELPFUL"]),
        })
        .strict(),
    )
    .max(3)
    .default([]),
  visualObservations: z
    .array(
      z
        .object({
          text: z.string().min(1).max(2000),
          visualCitationIds: z.array(z.string()).min(1).max(3),
        })
        .strict(),
    )
    .max(6)
    .default([]),
});

export function askAiSocket(
  config: ServerConfig,
  request: Schema["QuestionRequest"],
  signal?: AbortSignal,
): Promise<Schema["QuestionResult"]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("AI_UNAVAILABLE"));
      return;
    }
    const url = new URL("/v1/questions/ws", config.AI_SERVICE_BASE_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const auth = createAiRequestSignature({
      secret: config.AI_SERVICE_SHARED_SECRET,
      method: "GET",
      pathname: url.pathname,
      body: "",
      requestId: request.requestId,
    });
    const traceHeaders: Record<string, string> = {};
    propagation.inject(context.active(), traceHeaders);
    const ws = new WebSocket(url, {
      headers: {
        ...traceHeaders,
        "x-patch-contract-version": "v1",
        "x-patch-request-id": auth.requestId,
        "x-patch-timestamp": String(auth.timestamp),
        "x-patch-signature": auth.signature,
      },
      perMessageDeflate: false,
      maxPayload: 512_000,
      handshakeTimeout: Math.min(config.AI_SERVICE_TIMEOUT_MS, 10000),
    });
    let finished = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      ws.close();
    };
    const fail = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("AI_UNAVAILABLE"));
    };
    const abort = () => fail();
    const timer = setTimeout(fail, config.AI_SERVICE_TIMEOUT_MS);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      fail();
      return;
    }
    ws.on("open", () => ws.send(JSON.stringify(request)));
    ws.on("message", (raw) => {
      try {
        const event = z
          .object({
            type: z.enum([
              "question.progress",
              "question.result",
              "question.error",
            ]),
            requestId: z.string().uuid(),
            result: z.unknown().optional(),
          })
          .parse(JSON.parse(raw.toString()));
        if (event.requestId !== request.requestId) {
          fail();
          return;
        }
        if (event.type === "question.result" && !finished) {
          const result = answerSchema.parse(event.result);
          finished = true;
          cleanup();
          resolve(result);
        }
        if (event.type === "question.error") fail();
      } catch {
        fail();
      }
    });
    ws.on("error", fail);
    ws.on("close", () => {
      if (!finished) fail();
    });
  });
}
