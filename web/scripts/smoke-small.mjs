// Explicit hosted smoke only; never invoked by npm test. See Backend_Manual_Testing.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import WebSocket from "ws";

const [credentialsPath, mode] = process.argv.slice(2);
if (
  !credentialsPath ||
  !["setup", "dispatch", "status", "review", "chat"].includes(mode)
)
  throw new Error(
    "Usage: node --env-file=.env.local scripts/smoke-small.mjs <private-json> setup|dispatch|status|review|chat",
  );
const fixture = JSON.parse(readFileSync(credentialsPath, "utf8"));
const base = new URL(process.env.AUTH_URL);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Smoke targets must be loopback",
);
const report = (test, detail = {}) =>
  console.log(JSON.stringify({ test, ...detail }));
const cookies = new Map();
const cookie = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
async function api(path, body, { worker = false, expected, method } = {}) {
  const response = await fetch(new URL(path, base), {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      origin: base.origin,
      ...(worker
        ? { authorization: `Bearer ${process.env.BACKEND_WORKER_SECRET}` }
        : { cookie: cookie() }),
      ...(body instanceof URLSearchParams
        ? { "content-type": "application/x-www-form-urlencoded" }
        : body === undefined
          ? {}
          : { "content-type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof URLSearchParams
          ? body
          : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(330000),
  });
  if (!worker)
    for (const item of response.headers.getSetCookie()) {
      const pair = item.split(";")[0];
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  const result = await response.json().catch(() => ({}));
  if (expected)
    assert(
      expected.includes(response.status),
      `${path}: HTTP ${response.status}`,
    );
  else
    assert(
      response.ok,
      `${path}: HTTP ${response.status} (${result.error?.code ?? "REQUEST_FAILED"})`,
    );
  return result;
}
async function login(user, register = false) {
  cookies.clear();
  if (register)
    await api("/api/auth/signup", { ...user, confirmPassword: user.password });
  const { csrfToken } = await api("/api/auth/csrf");
  await api(
    "/api/auth/callback/credentials",
    new URLSearchParams({
      csrfToken,
      email: user.email,
      password: user.password,
      json: "true",
      callbackUrl: base.origin,
    }),
    { expected: [200, 302] },
  );
  const session = await api("/api/auth/session");
  assert(
    session.user?.id,
    "Sign-in did not establish an authenticated session",
  );
}
async function worker(mode) {
  return api("/api/internal/jobs/run", { mode, limit: 1 }, { worker: true });
}
const ids = fixture.ids ?? {};
async function status() {
  const version = await api(`/api/document-versions/${ids.documentVersionId}`);
  const procedures = await api(`/api/projects/${ids.projectId}/procedures`);
  const candidates = [];
  for (const p of procedures.items) {
    const versions = await api(
      `/api/projects/${ids.projectId}/procedures/${p.id}/versions`,
    );
    candidates.push(
      ...versions.items.map((v) => ({
        id: v.id,
        state: v.state,
        steps: v.steps.length,
        citations: v.citations.length,
        reviewStatus: v.reviewAnalysis?.status,
      })),
    );
  }
  const profiles = await Promise.all([
    api(`/api/equipments/${ids.equipmentId}/retrieval-profile`),
    api(`/api/projects/${ids.projectId}/retrieval-profile`),
  ]);
  report("workflow-status", {
    documentState: version.state,
    profiles: profiles.map((p) => p.state),
    candidates,
    generationStates: procedures.generationRequests.map((r) => r.status),
    jobs: (await worker("inspect")).counts,
  });
  return version;
}
try {
  assert.equal((await api("/api/readiness")).status, "ready");
  if (mode === "setup") {
    assert.equal(
      (await worker("inspect")).items.length,
      0,
      "Existing jobs: do not dispatch unrelated work",
    );
    assert(
      !fixture.ids,
      "Use a fresh credential file; setup must not duplicate records",
    );
    await login(fixture.owner, true);
    report("owner-signup-signin", { passed: true });
    const { equipment } = await api("/api/equipments", {
      name: `SMOKE ${fixture.runId}`,
      type: "SYNTHETIC_SOFTWARE_ONLY",
      location: "Test fixture; no physical equipment",
      description:
        "Synthetic backend smoke fixture; no physical work authorized.",
      documentsMode: "SKIP_FOR_NOW",
    });
    ids.equipmentId = equipment.id;
    const { project } = await api("/api/projects", {
      name: `SMOKE ${fixture.runId}`,
      description:
        "Synthetic software-test-card review only; not an actual maintenance project.",
      includedEquipmentIds: [equipment.id],
      documentsMode: "SKIP_FOR_NOW",
    });
    ids.projectId = project.id;
    const log = await api(`/api/projects/${ids.projectId}/maintenance-logs`, {
      scopeType: "PROJECT",
      text: "Synthetic backend smoke record. No physical maintenance was performed.",
      equipmentId: null,
      attachmentVersionIds: [],
      citations: [],
    });
    ids.logId = log.id;
    const submitted = await api(
      `/api/projects/${ids.projectId}/maintenance-logs/${log.id}/submit`,
      { expectedRevision: log.revision },
    );
    assert.equal(submitted.state, "SUBMITTED");
    await login(fixture.outsider, true);
    await api(`/api/projects/${ids.projectId}/maintenance-logs`, undefined, {
      expected: [403, 404],
    });
    await api(
      `/api/equipments/${ids.equipmentId}`,
      { description: "Unauthorized change must fail" },
      { method: "PATCH", expected: [403, 404] },
    );
    report("entities-log-access-denial", { passed: true });
    await login(fixture.owner);
    const bytes = readFileSync(
      new URL("../test/fixtures/project-review.txt", import.meta.url),
    );
    const upload = await api("/api/documents/upload-sessions", {
      title: `Synthetic test-card ${fixture.runId}`,
      documentType: "PROJECT_DOCUMENT",
      entity: { type: "EQUIPMENT", id: ids.equipmentId },
      contentType: "text/plain",
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    ids.documentId = upload.documentId;
    ids.documentVersionId = upload.documentVersionId;
    await api(`/api/projects/${ids.projectId}/documents`, {
      documentId: ids.documentId,
    });
    const put = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: bytes,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    assert(put.ok, `R2 upload HTTP ${put.status}`);
    await api(
      `/api/document-versions/${ids.documentVersionId}/complete-upload`,
      {},
    );
    report("immutable-upload-linked-once", { passed: true });
  } else {
    assert(
      ids.documentVersionId,
      "Store setup's returned IDs in the private credential JSON first",
    );
    await login(fixture.owner);
    if (mode === "dispatch") {
      // Exactly one job per explicit invocation. No automatic paid retry loop.
      report("one-job", await worker("dispatch"));
      await status();
    } else if (mode === "status") await status();
    else if (mode === "review") {
      const version = await api(
        `/api/document-versions/${ids.documentVersionId}`,
      );
      assert.equal(version.state, "NEEDS_REVIEW");
      const original = readFileSync(
        new URL("../test/fixtures/project-review.txt", import.meta.url),
        "utf8",
      )
        .replace(/\r\n/g, "\n")
        .trim();
      const extracted = version.extraction.pages
        .map((p) => p.text)
        .join("\n")
        .replace(/\r\n/g, "\n")
        .trim();
      assert.equal(
        extracted,
        original,
        "Only the exact known synthetic fixture may be auto-reviewed by this smoke helper",
      );
      await api(`/api/document-versions/${ids.documentVersionId}/review`, {
        decision: "APPROVE",
        title: `Synthetic test-card ${fixture.runId}`,
        revision: "1",
        confirmSourceReviewed: true,
      });
      report("synthetic-source-exact-review", { passed: true });
    } else if (mode === "chat") {
      assert.equal((await status()).state, "ACTIVE");
      for (const path of [
        `/api/equipments/${ids.equipmentId}/documents`,
        `/api/projects/${ids.projectId}/documents`,
      ]) {
        const documents = await api(path);
        assert.equal(
          documents.items.filter(
            (d) =>
              d.id === ids.documentId &&
              d.activeVersionId === ids.documentVersionId,
          ).length,
          1,
        );
      }
      const source = await api(
        `/api/document-versions/${ids.documentVersionId}/source`,
      );
      const original = await fetch(source.url, {
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      assert(original.ok);
      const expected = readFileSync(
        new URL("../test/fixtures/project-review.txt", import.meta.url),
      );
      assert(Buffer.from(await original.arrayBuffer()).equals(expected));
      report("shared-active-version-original", { passed: true });
      const session = await api("/api/chat/sessions", {});
      ids.chatSessionId = session.id;
      const url = new URL(`/ws/chat?sessionId=${session.id}`, base);
      url.protocol = base.protocol === "https:" ? "wss:" : "ws:";
      const input = {
        type: "turn.submit",
        clientTurnId: randomUUID(),
        question:
          "What observations does the synthetic software-test procedure ask the reviewer to record?",
        assignedReferences: [{ type: "DOCUMENT", id: ids.documentId }],
      };
      const turn = await new Promise((resolve, reject) => {
        const ws = new WebSocket(url, {
          headers: { cookie: cookie(), origin: base.origin },
        });
        const timer = setTimeout(() => {
          ws.terminate();
          reject(new Error("Smoke socket timeout"));
        }, 160000);
        ws.on("error", () => {
          clearTimeout(timer);
          reject(new Error("Smoke socket transport error"));
        });
        ws.on("message", (raw) => {
          const frame = JSON.parse(raw.toString());
          if (frame.type === "connection.ready") ws.send(JSON.stringify(input));
          if (frame.type === "turn.completed" || frame.type === "turn.error") {
            clearTimeout(timer);
            ws.close();
            if (frame.type === "turn.error")
              reject(new Error(`Socket: ${frame.code}`));
            else resolve(frame.turn);
          }
        });
      });
      report("web-ai-socket-result", {
        status: turn.result?.status,
        citations: turn.result?.citations?.length ?? 0,
      });
      assert(
        turn.result?.citations?.length > 0,
        "Live answer did not return source citations",
      );
      assert(
        turn.result.citations.every(
          (c) => c.documentVersionId === ids.documentVersionId,
        ),
      );
      const history = await api(`/api/chat/sessions/${session.id}/turns`);
      assert.equal(
        history.items.filter((t) => t.clientTurnId === input.clientTurnId)
          .length,
        1,
      );
      const replay = await api(`/api/chat/sessions/${session.id}/turns`, {
        clientTurnId: input.clientTurnId,
        question: input.question,
        assignedReferences: input.assignedReferences,
      });
      assert.equal(replay.id, turn.id);
      report("socket-history-idempotency", { passed: true });
    }
  }
} catch (error) {
  // Assertion messages contain only our safe labels/statuses, never URLs, credentials or response bodies.
  report("failed", {
    reason:
      error instanceof assert.AssertionError
        ? error.message
        : "Request failed; inspect safe server request IDs",
  });
  process.exitCode = 1;
} finally {
  report("synthetic-record-ids", { ids });
}
