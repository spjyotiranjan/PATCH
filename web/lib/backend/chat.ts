import "server-only";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { askAiSocket } from "@/lib/ai/socket";
import { withDatabaseTransaction } from "@/lib/database/mongodb";
import { audit, fail, fingerprint, oid, view, type Context } from "./context";
import type { Schema } from "./models";
import { assignedVersionIds, resolveManifest, validateAnswer } from "./scope";

export const turnSchema = z
  .object({
    clientTurnId: z.string().uuid(),
    question: z.string().trim().min(1).max(10000),
    assignedReferences: z
      .array(
        z
          .object({
            type: z.enum(["DOCUMENT", "EQUIPMENT", "PROJECT", "ENTITY"]),
            id: z.string().min(1).max(200),
          })
          .strict(),
      )
      .max(50)
      .default([]),
  })
  .strict();
interface ChatSession {
  _id: ObjectId;
  tenantId: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lockId?: string | null;
  lockUntil?: Date;
}
interface ChatTurn {
  _id: ObjectId;
  tenantId: string;
  sessionId: string;
  clientTurnId: string;
  inputFingerprint: string;
  question: string;
  assignedReferences: Schema["AssignedReference"][];
  state: "PENDING" | "COMPLETED";
  result?: Schema["QuestionResult"];
  createdAt: Date;
  completedAt?: Date;
}

export async function sessionAccess(ctx: Context, id: string) {
  const record = await ctx.db
    .collection<ChatSession>("chatSessions")
    .findOne(
      { _id: oid(id), tenantId: ctx.actor.tenantId, userId: ctx.actor.userId },
      { session: ctx.session },
    );
  if (!record) fail("CHAT_SESSION_NOT_FOUND", 404);
  return record;
}
export async function createSession(ctx: Context) {
  const record: ChatSession = {
    _id: new ObjectId(),
    tenantId: ctx.actor.tenantId,
    userId: ctx.actor.userId,
    title: "New conversation",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    await db
      .collection<ChatSession>("chatSessions")
      .insertOne(record, { session });
    await audit({ ...ctx, db, session }, "CHAT_SESSION_CREATED", {
      sessionId: record._id.toHexString(),
    });
    return view(record);
  });
}

function safeUnavailable(
  request: Schema["QuestionRequest"],
): Schema["QuestionResult"] {
  return {
    requestId: request.requestId,
    chatSession: {
      id: request.chatSession.id,
      suggestedTitle: "Source review needed",
    },
    turnId: request.requestId,
    status: "unavailable",
    routing: {
      selectedEntities: [],
      usedStructuralFallback: true,
      profileVersions: [],
    },
    answer: { summary: null, steps: [] },
    citations: [],
    warnings: [
      "Verified guidance is unavailable. Consult approved sources and the responsible reviewer.",
    ],
    followUpAllowed: true,
  };
}

export async function submitTurn(
  ctx: Context,
  sessionId: string,
  input: z.infer<typeof turnSchema>,
  signal?: AbortSignal,
) {
  const hash = fingerprint(input);
  const prepared = await withDatabaseTransaction(
    ctx.config,
    async (db, session) => {
      const tx = { ...ctx, db, session };
      await sessionAccess(tx, sessionId);
      const existing = await db.collection<ChatTurn>("chatTurns").findOne(
        {
          tenantId: ctx.actor.tenantId,
          sessionId,
          clientTurnId: input.clientTurnId,
        },
        { session },
      );
      if (existing) {
        if (existing.inputFingerprint !== hash) fail("IDEMPOTENCY_CONFLICT");
        if (existing.state !== "COMPLETED") fail("TURN_IN_PROGRESS");
        return { existing };
      }
      const lock = await db.collection<ChatSession>("chatSessions").updateOne(
        {
          _id: oid(sessionId),
          userId: ctx.actor.userId,
          $or: [{ lockId: null }, { lockUntil: { $lt: new Date() } }],
        },
        {
          $set: {
            lockId: input.clientTurnId,
            lockUntil: new Date(Date.now() + 180000),
            updatedAt: new Date(),
          },
        },
        { session },
      );
      if (!lock.modifiedCount) fail("CHAT_SESSION_BUSY");
      const manifest = await resolveManifest(tx);
      assignedVersionIds(manifest, input.assignedReferences);
      const history = await db
        .collection<ChatTurn>("chatTurns")
        .find(
          { tenantId: ctx.actor.tenantId, sessionId, state: "COMPLETED" },
          { session },
        )
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      const request: Schema["QuestionRequest"] = {
        requestId: randomUUID(),
        contractVersion: "v1",
        actor: { id: ctx.actor.userId, tenantId: ctx.actor.tenantId },
        chatSession: {
          id: sessionId,
          recentTurns: history.reverse().flatMap((t) => [
            { role: "user" as const, content: t.question },
            {
              role: "assistant" as const,
              content: (t.result?.answer.steps ?? [])
                .map((s) => s.text)
                .join("\n")
                .slice(0, 10000),
            },
          ]),
        },
        question: input.question,
        assignedReferences: input.assignedReferences,
        retrievalScopeManifest: manifest,
        retrievalPolicy: {
          approvedOnly: true,
          requireSourceLocation: true,
          allowStructuralFallback: true,
        },
      };
      const turn: ChatTurn = {
        _id: new ObjectId(),
        tenantId: ctx.actor.tenantId,
        sessionId,
        clientTurnId: input.clientTurnId,
        inputFingerprint: hash,
        question: input.question,
        assignedReferences: input.assignedReferences,
        state: "PENDING",
        createdAt: new Date(),
      };
      await db.collection<ChatTurn>("chatTurns").insertOne(turn, { session });
      await audit(tx, "CHAT_QUESTION_SUBMITTED", {
        sessionId,
        turnId: turn._id.toHexString(),
        serviceRequestId: request.requestId,
      });
      return { request, turn };
    },
  );
  if (prepared.existing) return view(prepared.existing);
  const request = prepared.request!;
  let result: Schema["QuestionResult"];
  try {
    result = await askAiSocket(ctx.config, request, signal);
    await validateAnswer(ctx, result, request);
  } catch {
    result = safeUnavailable(request);
  }
  return withDatabaseTransaction(ctx.config, async (db, session) => {
    const tx = { ...ctx, db, session };
    await sessionAccess(tx, sessionId);
    // Re-check current grants and versions after the potentially long AI call.
    try {
      const current = await resolveManifest(tx);
      await validateAnswer(tx, result, {
        ...request,
        retrievalScopeManifest: current,
      });
    } catch {
      result = safeUnavailable(request);
    }
    const lock = await db
      .collection<ChatSession>("chatSessions")
      .updateOne(
        { _id: oid(sessionId), lockId: input.clientTurnId },
        { $set: { lockId: null, updatedAt: new Date() } },
        { session },
      );
    if (!lock.modifiedCount) fail("TURN_LEASE_EXPIRED");
    await db
      .collection<ChatSession>("chatSessions")
      .updateOne(
        { _id: oid(sessionId), title: "New conversation" },
        { $set: { title: result.chatSession.suggestedTitle } },
        { session },
      );
    const completed: ChatTurn = {
      ...prepared.turn!,
      state: "COMPLETED",
      result,
      completedAt: new Date(),
    };
    await db
      .collection<ChatTurn>("chatTurns")
      .replaceOne({ _id: completed._id, state: "PENDING" }, completed, {
        session,
      });
    await audit(tx, "CHAT_ANSWER_SAVED", {
      sessionId,
      turnId: completed._id.toHexString(),
      status: result.status,
      serviceRequestId: request.requestId,
      citationCount: result.citations?.length ?? 0,
    });
    return view(completed);
  });
}
