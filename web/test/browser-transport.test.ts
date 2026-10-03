import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiRequestError } from "@/lib/api/http";
import { transferUpload, fileContentType } from "@/lib/api/document-workflow";
import {
  saveProcedure,
  transitionProcedure,
  changeStep,
  submitLog,
} from "@/lib/api/workflows";
import { sendTurn } from "@/lib/api/chat-workflow";
import type { ProcedureVersion, Run, Log } from "@/lib/api/contracts";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("same-origin browser API", () => {
  it("rejects external transports before fetching", async () => {
    await expect(api("https://example.test/api/private")).rejects.toMatchObject(
      { code: "INVALID_API_PATH" },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("includes the session but never caches authenticated reads", async () => {
    fetchMock.mockResolvedValue(response({ items: [] }));
    expect(await api("/api/projects")).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });
  it.each([401, 403, 409, 429, 503])(
    "fails closed on HTTP %s without displaying private messages",
    async (status) => {
      fetchMock.mockResolvedValue(
        response(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "private configuration",
            },
            requestId: "trace",
          },
          status,
        ),
      );
      const error = await api("/api/projects").catch((error) => error);
      expect(error).toBeInstanceOf(ApiRequestError);
      if (!(error instanceof ApiRequestError))
        throw new Error("Expected API failure");
      expect(error.status).toBe(status);
      expect(error.message).not.toContain("private configuration");
    },
  );
});

describe("immutable uploads and optimistic concurrency", () => {
  const session = {
    documentId: "doc",
    documentVersionId: "version",
    uploadUrl: "https://storage.example.test/signed",
    headers: { "Content-Type": "application/pdf" },
  };
  const file = new File(["%PDF-example"], "example.pdf", {
    type: "application/pdf",
  });
  it("sends raw original bytes without credentials before finalizing exactly that version", async () => {
    fetchMock.mockResolvedValue(response({}));
    await transferUpload(session, file);
    expect(fetchMock.mock.calls[0]).toEqual([
      session.uploadUrl,
      expect.objectContaining({
        method: "PUT",
        credentials: "omit",
        body: file,
        redirect: "error",
      }),
    ]);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/document-versions/version/complete-upload",
    );
  });
  it("never finalizes failed transfer; retains its immutable upload session", async () => {
    fetchMock.mockResolvedValue(response({}, 403));
    await expect(transferUpload(session, file)).rejects.toMatchObject({
      session,
      bytesUploaded: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("retains successful bytes when finalization fails, for retry without reupload", async () => {
    fetchMock
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({}, 503));
    await expect(transferUpload(session, file)).rejects.toMatchObject({
      session,
      bytesUploaded: true,
    });
  });
  it("rejects unsupported and empty originals", () => {
    expect(() => fileContentType(new File(["x"], "payload.exe"))).toThrow();
    expect(() => fileContentType(new File([], "empty.pdf"))).toThrow();
  });
  it("sends editable procedure fields and the exact observed revision only", async () => {
    fetchMock.mockResolvedValue(response({}));
    const version: ProcedureVersion = {
      id: "version",
      projectId: "project",
      procedureId: "procedure",
      revision: 7,
      title: "Saved",
      versionNumber: 1,
      state: "DRAFT",
      createdAt: "2026-09-22",
      updatedAt: "2026-09-22",
      reviewAnalysis: {
        reviewNeed: "LOW",
        reasons: [],
        blockingFindings: [],
        applicability: "Applicable",
        conflicts: "None",
        freshness: "Current",
        hardwareCriticality: "Low",
        sourceCoverage: "Complete",
      },
      steps: [
        {
          stepId: "stable",
          title: "Step",
          instructions: "Read label",
          required: true,
          citationIds: ["citation"],
          evidenceState: "SUPPORTED",
          citationReviewState: "CONFIRMED",
          position: 1,
        },
      ],
      citations: [],
    };
    await saveProcedure(version);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      expectedRevision: 7,
      title: "Saved",
      steps: [
        {
          stepId: "stable",
          title: "Step",
          instructions: "Read label",
          required: true,
          citationIds: ["citation"],
        },
      ],
      citations: [],
    });
    await transitionProcedure(version, "approve", ["review reason"]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      expectedRevision: 7,
      confirmHumanReview: true,
      acknowledgedReasons: ["review reason"],
    });
    await changeStep(
      { id: "run", revision: 3, steps: [] } as unknown as Run,
      "stable",
      true,
      "Observed",
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      expectedRevision: 3,
      checked: true,
      note: "Observed",
      exception: null,
    });
    await submitLog({ id: "log", projectId: "project", revision: 2 } as Log);
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
      expectedRevision: 2,
    });
  });
});

class FakeSocket {
  static latest: FakeSocket;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: URL) {
    FakeSocket.latest = this;
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
describe("verified whole-turn WebSocket transport", () => {
  const input = {
    clientTurnId: "326b8ef5-6fe9-4005-87eb-e49a68a157e8",
    question: "Read the diagram",
    assignedReferences: [],
  };
  beforeEach(() => vi.stubGlobal("WebSocket", FakeSocket));
  it("waits for matching gateway readiness and reuses the supplied idempotency key", async () => {
    const progress = vi.fn();
    const promise = sendTurn("session", input, progress);
    const socket = FakeSocket.latest;
    expect(socket.url.pathname).toBe("/ws/chat");
    expect(socket.url.host).toBe(window.location.host);
    expect(socket.send).not.toHaveBeenCalled();
    socket.emit({ type: "connection.ready", sessionId: "session" });
    socket.emit({ type: "connection.ready", sessionId: "session" });
    expect(socket.send).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ type: "turn.submit", ...input }),
    );
    socket.emit({ type: "turn.processing", clientTurnId: input.clientTurnId });
    const turn = {
      clientTurnId: input.clientTurnId,
      sessionId: "session",
      state: "COMPLETED",
    };
    socket.emit({
      type: "turn.completed",
      clientTurnId: input.clientTurnId,
      turn,
    });
    await expect(promise).resolves.toEqual(turn);
    expect(progress).toHaveBeenCalledWith("turn.processing");
    expect(socket.close).toHaveBeenCalledOnce();
  });
  it("rejects a completed turn belonging to another session", async () => {
    const promise = sendTurn("session", input, vi.fn());
    FakeSocket.latest.emit({
      type: "turn.completed",
      clientTurnId: input.clientTurnId,
      turn: { ...input, sessionId: "other", state: "COMPLETED" },
    });
    await expect(promise).rejects.toMatchObject({
      code: "INVALID_SOCKET_RESPONSE",
    });
  });
  it("disconnects without a fake answer or REST resubmission", async () => {
    const promise = sendTurn("session", input, vi.fn());
    FakeSocket.latest.onclose?.();
    await expect(promise).rejects.toMatchObject({ code: "TURN_INTERRUPTED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("aborts on navigation and releases its socket", async () => {
    const controller = new AbortController();
    const promise = sendTurn("session", input, vi.fn(), controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeSocket.latest.close).toHaveBeenCalledOnce();
  });
});
