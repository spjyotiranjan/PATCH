import { test, expect, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Browser integration fixtures are synthetic API contracts, never production fallbacks.
const owner = "1".repeat(24),
  equipmentId = "2".repeat(24),
  projectId = "3".repeat(24);
const documentId = "4".repeat(24),
  versionId = "5".repeat(24),
  sessionId = "6".repeat(24);
const procedureId = "7".repeat(24),
  definitionId = "8".repeat(24),
  runId = "9".repeat(24);
const now = new Date().toISOString();
const equipment = {
  id: equipmentId,
  ownerId: owner,
  name: "Integration pump",
  type: "Pump",
  model: "P-1",
  location: "Test bay",
  description: "Synthetic browser fixture",
  operationalState: "UNKNOWN",
  accessLevel: "OWNER",
  documentsMode: "SKIP_FOR_NOW",
  createdAt: now,
  updatedAt: now,
};
const project = {
  id: projectId,
  name: "Integration inspection",
  description: "Synthetic inspection project",
  status: "ACTIVE",
  role: "OWNER",
  includedEquipmentIds: [equipmentId],
  procedureGenerationStatus: "READY",
  createdAt: now,
  updatedAt: now,
};
const document = {
  id: documentId,
  ownerId: owner,
  title: "Synthetic source",
  documentType: "MANUAL",
  origin: { type: "PERSONAL", id: owner },
  activeVersionId: versionId,
  nextVersion: 2,
  createdAt: now,
  updatedAt: now,
};
const version = {
  id: versionId,
  documentId,
  versionNumber: 1,
  contentType: "application/pdf",
  bytes: 100,
  sha256: "a".repeat(64),
  state: "ACTIVE",
  approvalState: "APPROVED",
  extraction: {
    documentSummary: { summary: "Synthetic source for browser checks" },
    pages: [{ page: 1, section: "Label", text: "The test label is amber." }],
    errors: [],
  },
  createdAt: now,
  updatedAt: now,
};
const citation = {
  id: "citation-1",
  documentId,
  documentVersionId: versionId,
  chunkId: "chunk",
  documentTitle: document.title,
  revision: "1",
  page: 1,
  section: "Label",
  excerpt: "The test label is amber.",
  approvalState: "APPROVED",
};
const definition = {
  id: definitionId,
  procedureId,
  projectId,
  versionNumber: 1,
  state: "IN_REVIEW",
  revision: 2,
  title: "Inspect the test label",
  steps: [
    {
      stepId: "step-1",
      position: 1,
      title: "Read the label",
      instructions: "Compare the label with the approved source.",
      required: true,
      citationIds: [citation.id],
      evidenceState: "SUPPORTED",
      citationReviewState: "CONFIRMED",
    },
  ],
  citations: [citation],
  reviewAnalysis: {
    reviewNeed: "LOW",
    reasons: ["Confirm the source label"],
    blockingFindings: [],
  },
  createdAt: now,
  updatedAt: now,
};
const session = {
  id: sessionId,
  title: "Source questions",
  createdAt: now,
  updatedAt: now,
};
type Write = { path: string; method: string; body: Record<string, unknown> };

for (const theme of ["light", "dark"] as const) {
  test(`sidebar stays anchored while chat and history scroll in ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript(
      (choice) => localStorage.setItem("patch-theme", choice),
      theme,
    );
    const h = await harness(page);
    await page.route("**/api/chat/sessions", (route) =>
      route.fulfill({
        json: {
          items: Array.from({ length: 60 }, (_, i) => ({
            ...session,
            id: String(i).padStart(24, "0"),
            title: `History session ${i + 1}`,
          })),
        },
      }),
    );
    h.state.turns.push(
      ...Array.from({ length: 18 }, (_, i) => ({
        id: `long-turn-${i}`,
        sessionId,
        clientTurnId: `long-client-${i}`,
        question: `Question ${i + 1}: explain the saved test label.`,
        assignedReferences: [],
        state: "COMPLETED",
        createdAt: now,
        result: {
          status: "approved",
          answer: {
            steps: [
              {
                id: `step-${i}`,
                text: "The test label is amber. This is saved synthetic source context for a browser scrolling check.",
                citationIds: [citation.id],
              },
            ],
          },
          citations: [citation],
          warnings: [],
          routing: { selectedEntities: [] },
          followUpAllowed: true,
        },
      })),
    );
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto(`/chat/${sessionId}`);
    const sidebar = page.getByRole("complementary", {
      name: "Workspace navigation",
    });
    const history = sidebar.locator(".chat-history");
    await expect(history.getByRole("link")).toHaveCount(60);
    await page.getByRole("region", { name: "Conversation" }).hover();
    await page.mouse.wheel(0, 1800);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(500);
    expect((await sidebar.boundingBox())!.y).toBe(0);
    expect((await sidebar.boundingBox())!.height).toBe(600);
    const settings = sidebar.getByRole("link", {
      name: "Settings",
      exact: true,
    });
    expect((await settings.boundingBox())!.y).toBeLessThan(600);
    await expect(
      sidebar.getByRole("link", { name: "Home", exact: true }),
    ).toBeInViewport();
    await expect(settings).toBeInViewport();
    const pageScroll = await page.evaluate(() => window.scrollY);
    await history.hover();
    await page.mouse.wheel(0, 1000);
    await expect
      .poll(() => history.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    await page.mouse.wheel(0, 10000);
    await expect
      .poll(() =>
        history.evaluate(
          (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
        ),
      )
      .toBe(true);
    await page.mouse.wheel(0, 1000);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    const collapse = sidebar.getByRole("button", {
      name: "Collapse chat history",
    });
    const row = await sidebar.locator(".chat-heading").boundingBox();
    const control = await collapse.boundingBox();
    expect(control!.x + control!.width).toBeLessThanOrEqual(
      row!.x + row!.width,
    );
    await collapse.focus();
    await page.keyboard.press("Enter");
    await expect(history).toBeHidden();
    await expect(
      sidebar.getByRole("link", { name: "New chat", exact: true }),
    ).toBeInViewport();
    await sidebar.getByRole("button", { name: "Expand chat history" }).click();
    await expect(history).toBeVisible();
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-sidebar-${theme}.png`),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(settings).toBeInViewport();
    const mobileScroll = await page.evaluate(() => window.scrollY);
    await history.hover();
    await page.mouse.wheel(0, -1000);
    await expect
      .poll(() => history.evaluate((el) => el.scrollTop))
      .toBeLessThan(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(mobileScroll);
    expect((await sidebar.boundingBox())!.height).toBe(844);
    await page
      .getByRole("button", { name: "Close navigation" })
      .click({ position: { x: 350, y: 100 } });
    expect(h.errors).toEqual([]);
    expect(h.unmatched).toEqual([]);
  });
}

async function harness(
  page: Page,
  options: {
    authenticated?: boolean;
    member?: boolean;
    review?: boolean;
    blocked?: boolean;
  } = {},
) {
  const writes: Write[] = [];
  const unmatched: string[] = [];
  const errors: string[] = [];
  const state = {
    equipment: structuredClone(equipment),
    project: {
      ...structuredClone(project),
      role: options.member ? "MEMBER" : "OWNER",
    },
    document: {
      ...structuredClone(document),
      activeVersionId: options.review ? null : versionId,
    },
    version: {
      ...structuredClone(version),
      state: options.review ? "NEEDS_REVIEW" : "ACTIVE",
      approvalState: options.review ? "PENDING" : "APPROVED",
    },
    definition: {
      ...structuredClone(definition),
      reviewAnalysis: {
        ...definition.reviewAnalysis,
        reviewNeed: options.blocked ? "SEVERE" : "LOW",
        blockingFindings: options.blocked ? ["Missing current source"] : [],
      },
    },
    logs: [] as Record<string, unknown>[],
    turns: [] as Record<string, unknown>[],
    run: {
      id: runId,
      projectId,
      procedureId,
      procedureVersionId: definitionId,
      periodStart: new Date(Date.now() - 3600000).toISOString(),
      periodEnd: new Date(Date.now() + 3600000).toISOString(),
      timezone: "UTC",
      state: "OPEN",
      revision: 1,
      steps: [
        {
          stepId: "step-1",
          required: true,
          checked: false,
          note: "",
          exception: null,
          actorId: null as string | null,
          updatedAt: null as string | null,
        },
      ],
    },
  };
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = request.postDataJSON() as Record<string, unknown> | null;
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, json: data });
    if (method !== "GET") writes.push({ path, method, body: body ?? {} });
    if (path === "/api/auth/session")
      return reply(
        options.authenticated === false
          ? {}
          : {
              user: {
                id: owner,
                tenantId: "browser-test",
                name: "Test Owner",
                email: "owner@example.test",
              },
              expires: "2099-01-01T00:00:00.000Z",
            },
      );
    if (path === "/api/settings")
      return reply({
        profile: { name: "Test Owner", email: "owner@example.test" },
        preferences: { theme: "light" },
      });
    if (path === "/api/chat/sessions")
      return reply(method === "POST" ? session : { items: [session] });
    if (path === `/api/chat/sessions/${sessionId}`) return reply(session);
    if (path === `/api/chat/sessions/${sessionId}/turns`)
      return reply({ items: state.turns });
    if (path === "/api/chat/references")
      return reply({
        entities: [{ type: "PROJECT", id: projectId }],
        allowedDocumentVersions: [{ documentId, documentVersionId: versionId }],
      });
    if (path === "/api/equipments")
      return reply(
        method === "POST"
          ? { equipment: state.equipment }
          : { items: [state.equipment] },
      );
    if (path === "/api/projects")
      return reply(
        method === "POST"
          ? { project: state.project }
          : { items: [state.project] },
      );
    if (path.endsWith("/discover")) return reply({ items: [] });
    if (path === `/api/equipments/${equipmentId}`) {
      if (method === "PATCH") Object.assign(state.equipment, body);
      return reply({ equipment: state.equipment });
    }
    if (path === `/api/projects/${projectId}`) {
      if (method === "PATCH") Object.assign(state.project, body);
      return reply({ project: state.project });
    }
    if (path.endsWith("/retrieval-profile")) return reply({ state: "MISSING" });
    if (
      path === `/api/projects/${projectId}/documents` ||
      path === `/api/equipments/${equipmentId}/documents`
    )
      return reply({ items: [state.document], links: [] });
    if (path === "/api/documents") return reply({ items: [state.document] });
    if (path === `/api/documents/${documentId}`) return reply(state.document);
    if (path === `/api/documents/${documentId}/versions`)
      return reply({ items: [state.version] });
    if (path === "/api/documents/upload-sessions")
      return reply({
        documentId,
        documentVersionId: versionId,
        uploadUrl: "https://storage.example.test/original",
        headers: { "Content-Type": "application/pdf" },
      });
    if (path === `/api/document-versions/${versionId}`)
      return reply(state.version);
    if (path.endsWith("/complete-upload")) {
      state.version.state = "NEEDS_REVIEW";
      state.version.approvalState = "PENDING";
      return reply(state.version);
    }
    if (path.endsWith("/review") && path.includes("document-versions")) {
      state.version.state = "INDEXING";
      state.version.approvalState = "APPROVED";
      return reply(state.version);
    }
    if (path === `/api/document-versions/${versionId}/source`)
      return reply({
        url: "https://storage.example.test/original",
        expiresIn: 300,
      });
    if (path.endsWith("/visual-assets")) return reply({ items: [] });
    if (path.endsWith("/visual-discovery"))
      return reply({ status: "NOT_REQUESTED", partial: false });
    if (path === `/api/projects/${projectId}/maintenance-logs`) {
      if (method === "POST") {
        const log = {
          ...body,
          id: "log-1",
          projectId,
          createdBy: owner,
          state: "DRAFT",
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        state.logs.push(log);
        return reply(log);
      }
      return reply({ items: state.logs });
    }
    if (path.endsWith("/maintenance-logs/log-1/submit")) {
      Object.assign(state.logs[0], { state: "SUBMITTED", revision: 2 });
      return reply(state.logs[0]);
    }
    if (path === `/api/projects/${projectId}/procedures`)
      return reply({
        items: [
          {
            id: procedureId,
            projectId,
            title: definition.title,
            currentPublishedVersionId: definitionId,
            schedule: {
              frequency: "DAILY",
              interval: 1,
              timezone: "UTC",
              localStart: "2026-01-01T00:00:00",
            },
          },
        ],
        generationRequests: [],
      });
    if (
      path === `/api/projects/${projectId}/procedures/${procedureId}/versions`
    )
      return reply({ items: [state.definition] });
    if (path === `/api/projects/${projectId}/procedures/${procedureId}/runs`)
      return reply(method === "POST" ? state.run : { items: [state.run] });
    const definitionPath = `/api/projects/${projectId}/procedures/${procedureId}/versions/${definitionId}`;
    if (path === definitionPath)
      return reply({ ...state.definition, state: "PUBLISHED" });
    if (path === `${definitionPath}/approve`) {
      state.definition.state = "APPROVED";
      state.definition.revision++;
      return reply(state.definition);
    }
    if (path === `${definitionPath}/publish`) {
      state.definition.state = "PUBLISHED";
      state.definition.revision++;
      return reply(state.definition);
    }
    if (path === `/api/procedure-runs/${runId}`) return reply(state.run);
    if (path === `/api/procedure-runs/${runId}/steps/step-1/completion`) {
      Object.assign(state.run.steps[0], body, {
        actorId: owner,
        updatedAt: now,
      });
      state.run.revision++;
      return reply(state.run);
    }
    if (path === `/api/procedure-runs/${runId}/complete`) {
      state.run.state = "COMPLETED";
      state.run.revision++;
      return reply(state.run);
    }
    unmatched.push(`${method} ${path}`);
    return reply({ error: { code: "UNEXPECTED_TEST_REQUEST" } }, 501);
  });
  await page.route("https://storage.example.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "%PDF-1.4\n%%EOF",
    }),
  );
  return { state, writes, unmatched, errors };
}

test("unauthenticated navigation redirects without loading product data", async ({
  page,
}) => {
  const h = await harness(page, { authenticated: false });
  await page.goto("/equipments");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByLabel(/^email/i)).toHaveValue("");
  expect(h.writes).toEqual([]);
  expect(h.unmatched).toEqual([]);
  expect(h.errors).toEqual([]);
});
test("Equipment edits use actual API fields and preserve existing records", async ({
  page,
}) => {
  const h = await harness(page);
  await page.goto(`/equipments/${equipmentId}`);
  await expect(page.getByText("Model: P-1")).toBeVisible();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Location", { exact: false }).fill("Inspection bay");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Pump · Inspection bay")).toBeVisible();
  expect(h.writes.find((w) => w.method === "PATCH")?.body).toEqual({
    name: equipment.name,
    description: equipment.description,
    type: "Pump",
    location: "Inspection bay",
    model: "P-1",
    operationalState: "UNKNOWN",
  });
  expect(h.unmatched).toEqual([]);
  expect(h.errors).toEqual([]);
});
test("Project creation includes selected Equipment and never posts a made-up project code", async ({
  page,
}) => {
  const h = await harness(page);
  await page.goto("/projects/new");
  await page.getByLabel("Name", { exact: false }).fill("New inspection");
  await page
    .getByLabel("Description", { exact: false })
    .fill("A synthetic browser inspection project.");
  await page.getByLabel(/Integration pump/).check();
  await page.getByRole("button", { name: "Create and continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Project created" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open workspace", exact: true }),
  ).toHaveAttribute("href", `/projects/${projectId}`);
  expect(h.writes.find((w) => w.path === "/api/projects")?.body).toEqual({
    name: "New inspection",
    description: "A synthetic browser inspection project.",
    status: "PLANNING",
    includedEquipmentIds: [equipmentId],
    documentsMode: "SKIP_FOR_NOW",
  });
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});
test("original upload, explicit source review, and indexing stay separate", async ({
  page,
}) => {
  const h = await harness(page, { review: true });
  await page.goto("/documents");
  await page
    .getByRole("button", { name: "Add new document", exact: true })
    .click();
  await page
    .getByLabel("Document title", { exact: false })
    .fill("Browser source");
  await page.getByLabel("Original file", { exact: false }).setInputFiles({
    name: "source.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nSynthetic browser source"),
  });
  await page.getByRole("button", { name: "Upload original" }).click();
  await expect(page).toHaveURL(`/documents/${versionId}`);
  await expect(
    page.getByRole("button", { name: "Approve for indexing" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Open / refresh original" }).click();
  await expect(page.getByTitle("Exact original PDF")).toBeVisible();
  await page.getByLabel(/I compared the original/).check();
  await page.getByRole("button", { name: "Approve for indexing" }).click();
  await expect(page.getByText("indexing", { exact: true })).toBeVisible();
  expect(
    h.writes.find((w) => w.path.endsWith("/review"))?.body
      .confirmSourceReviewed,
  ).toBe(true);
  expect(h.writes.some((w) => w.path.endsWith("/activate"))).toBe(false);
  expect(
    h.writes.find((w) => w.path === "/api/documents/upload-sessions")?.body
      .sha256,
  ).toMatch(/^[a-f0-9]{64}$/);
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});
test("typed chat attachments select authorized context and preserve the gateway payload", async ({
  page,
}) => {
  const h = await harness(page);
  await page.route("**/api/chat/references", (route) =>
    route.fulfill({
      json: {
        entities: [
          { type: "PROJECT", id: projectId },
          { type: "EQUIPMENT", id: equipmentId },
        ],
        allowedDocumentVersions: [{ documentId, documentVersionId: versionId }],
      },
    }),
  );
  let submitted: Record<string, unknown> | undefined;
  await page.routeWebSocket(/\/ws\/chat\?/, (ws) => {
    ws.send(JSON.stringify({ type: "connection.ready", sessionId }));
    ws.onMessage((raw) => {
      submitted = JSON.parse(raw.toString());
      ws.send(
        JSON.stringify({
          type: "turn.processing",
          clientTurnId: submitted!.clientTurnId,
        }),
      );
    });
  });
  await page.goto(`/chat/${sessionId}`);
  const question = page.getByLabel("Question", { exact: true });
  await question.fill("Explain @");
  await expect(page.getByRole("option")).toHaveText([
    "Project",
    "Equipment",
    "Document",
  ]);
  await question.press("Enter");
  await expect(question).toHaveValue("Explain @project:");
  await question.pressSequentially("inspection");
  await question.press("Tab");
  await expect(
    page.getByText("@project:Integration inspection", { exact: true }),
  ).toBeVisible();
  await question.pressSequentially("@equipment:pump");
  await page
    .getByRole("option", { name: "Integration pump", exact: true })
    .click();
  await question.pressSequentially("@documents:source");
  await question.press("Enter");
  await expect(
    page.getByText("@documents:Synthetic source", { exact: true }),
  ).toBeVisible();
  await expect(question).toHaveValue("Explain ");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect
    .poll(() => submitted?.assignedReferences)
    .toEqual([
      { type: "PROJECT", id: projectId },
      { type: "EQUIPMENT", id: equipmentId },
      { type: "DOCUMENT", id: documentId },
    ]);
  expect(submitted?.question).toBe("Explain");
  await expect(question).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Remove Integration pump" }),
  ).toBeDisabled();
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});

test("typed chat attachments show empty results, dismiss and remove previews on tablet", async ({
  page,
}) => {
  const h = await harness(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`/chat/${sessionId}`);
  const question = page.getByLabel("Question", { exact: true });
  await page.getByRole("button", { name: "Attach context" }).click();
  await expect(question).toHaveValue("@");
  await page.getByRole("option", { name: "Equipment", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "No matching sources" }),
  ).toBeVisible();
  await question.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await question.fill("@documents:Synthetic");
  await page
    .getByRole("option", { name: "Synthetic source", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove Synthetic source" }).click();
  await expect(
    page.getByText("@documents:Synthetic source", { exact: true }),
  ).toHaveCount(0);
  await question.fill("@documents:missing");
  await expect(
    page.getByRole("status").filter({ hasText: "No matching sources" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => window.document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await question.fill("@");
  await page.screenshot({ path: join(tmpdir(), "patch-chat-mentions.png") });
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});

test("chat submits over the gateway and renders only the completed verified result", async ({
  page,
}) => {
  const h = await harness(page);
  let submitted: Record<string, unknown> | undefined;
  let complete: (() => void) | undefined;
  await page.routeWebSocket(/\/ws\/chat\?/, (ws) => {
    ws.send(JSON.stringify({ type: "connection.ready", sessionId }));
    ws.onMessage((raw) => {
      submitted = JSON.parse(raw.toString());
      const turn = {
        id: "turn-1",
        sessionId,
        clientTurnId: submitted!.clientTurnId,
        question: submitted!.question,
        assignedReferences: [],
        state: "COMPLETED",
        createdAt: now,
        result: {
          status: "approved",
          answer: {
            steps: [
              {
                id: "s1",
                text: "The test label is amber.",
                citationIds: [citation.id],
              },
            ],
          },
          citations: [citation],
          warnings: [],
          routing: { selectedEntities: [] },
          visualEvidenceState: "TEXT_ONLY",
          followUpAllowed: true,
        },
      };
      ws.send(
        JSON.stringify({
          type: "turn.processing",
          clientTurnId: turn.clientTurnId,
        }),
      );
      complete = () => {
        h.state.turns.push(turn);
        ws.send(
          JSON.stringify({
            type: "turn.completed",
            clientTurnId: turn.clientTurnId,
            turn,
          }),
        );
      };
    });
  });
  await page.goto(`/chat/${sessionId}`);
  await page
    .getByLabel("Question", { exact: true })
    .fill("What colour is the test label?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Checking sources and preparing a response" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".chat-markdown p")
      .filter({ hasText: "The test label is amber." }),
  ).toHaveCount(0);
  complete!();
  await expect(
    page
      .locator(".chat-markdown p")
      .filter({ hasText: "The test label is amber." }),
  ).toBeVisible();
  expect(submitted?.type).toBe("turn.submit");
  expect(submitted?.clientTurnId).toMatch(/^[a-f0-9-]{36}$/);
  await page
    .getByRole("button", { name: "Evidence used", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: document.title }),
  ).toBeVisible();
  expect(h.writes.some((w) => w.path.endsWith("/turns"))).toBe(false);
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});
test("maintenance draft requires separate human submission and is then read-only", async ({
  page,
}) => {
  const h = await harness(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/projects/${projectId}/maintenance-logs`);
  await page.getByRole("button", { name: "New log" }).click();
  await page
    .getByLabel("Final user wording", { exact: false })
    .fill("Observed the amber test label. No work performed.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("button", { name: "Submit saved log" }),
  ).toBeVisible();
  expect(h.writes).toHaveLength(1);
  await page.getByRole("button", { name: "Submit saved log" }).click();
  await expect(
    page.getByLabel("Final user wording", { exact: false }),
  ).toBeDisabled();
  expect(h.writes[1].body).toEqual({ expectedRevision: 1 });
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});
for (const theme of ["light", "dark"] as const) {
  test(`procedure accordions preserve edits, ordering and save payload in ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (choice) => localStorage.setItem("patch-theme", choice),
      theme,
    );
    const h = await harness(page);
    h.state.definition.state = "DRAFT";
    Object.assign(h.state.definition.reviewAnalysis, {
      sourceCoverage: "COMPLETE",
      conflicts: "NONE_DETECTED",
      freshness: "CURRENT",
      hardwareCriticality: "LOW",
      applicability: "SUPPORTED",
      requiredTopics: ["Document identity", "Label wording"],
      missingTopics: [],
      reasons: ["VERIFY_COVERAGE_APPLICABILITY_AND_HARDWARE"],
    });
    h.state.definition.steps = [
      "Confirm document identity",
      "Compare label wording",
      "Record review result",
    ].map((title, i) => ({
      ...definition.steps[0],
      stepId: `step-${i + 1}`,
      position: i + 1,
      title,
    }));
    let saved: Record<string, unknown> | undefined;
    await page.route(
      `**/api/projects/${projectId}/procedures/${procedureId}/versions/${definitionId}`,
      async (route) => {
        if (route.request().method() === "GET") return route.fallback();
        expect(route.request().method()).toBe("PATCH");
        saved = route.request().postDataJSON();
        Object.assign(h.state.definition, {
          ...saved,
          revision: 3,
          state: "DRAFT",
        });
        h.state.definition.steps = h.state.definition.steps.map(
          (step, index) => ({
            ...step,
            position: index + 1,
            evidenceState: "SUPPORTED",
            citationReviewState: "NEEDS_REVIEW",
          }),
        );
        await route.fulfill({ json: h.state.definition });
      },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `/projects/${projectId}/procedures/${procedureId}/edit?version=${definitionId}`,
    );
    const steps = page.locator(".procedure-step");
    await expect(steps).toHaveCount(3);
    await expect(steps.first()).toHaveAttribute("open", "");
    await expect(
      steps.nth(1).getByLabel("Step title", { exact: true }),
    ).toBeHidden();
    await expect(steps.nth(1).locator("summary")).toContainText(
      "Compare label wording",
    );
    await expect(
      page.getByText("Hardware criticality", { exact: true }),
    ).toBeVisible();
    const reviewPanel = page.locator(".procedure-review-panel");
    await expect(
      reviewPanel.getByRole("checkbox", {
        name: "Verify coverage applicability and hardware",
      }),
    ).toBeVisible();
    expect(
      await reviewPanel.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await reviewPanel.locator(".integration-check").first().screenshot({
      path: join(tmpdir(), `patch-ui-procedure-review-${theme}.png`),
      style: ".procedure-save-bar { visibility: hidden; }",
    });
    const evidenceCard = page.locator(".procedure-evidence-card").first();
    await expect(evidenceCard.locator("summary")).toContainText(
      definition.citations[0].documentTitle,
    );
    await expect(evidenceCard.locator("summary")).toContainText("Revision 1");
    await expect(evidenceCard.locator("blockquote")).toBeHidden();
    await expect(
      evidenceCard.getByRole("button", { name: "Get current source access" }),
    ).toBeHidden();
    await evidenceCard.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(evidenceCard.locator("blockquote")).toHaveText(
      definition.citations[0].excerpt,
    );
    await expect(evidenceCard.locator("blockquote")).toBeVisible();
    await expect(
      evidenceCard.getByRole("button", { name: "Get current source access" }),
    ).toBeVisible();
    await page.locator(".procedure-evidence").screenshot({
      path: join(tmpdir(), `patch-ui-procedure-evidence-expanded-${theme}.png`),
    });
    await evidenceCard.locator("summary").click();
    await expect(evidenceCard.locator("blockquote")).toBeHidden();
    await page.locator(".procedure-evidence").screenshot({
      path: join(tmpdir(), `patch-ui-procedure-evidence-${theme}.png`),
    });
    await page
      .getByLabel("Procedure title", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-procedure-editor-${theme}.png`),
    });
    await page
      .getByRole("button", { name: "Collapse all", exact: true })
      .click();
    await expect(page.locator(".procedure-step[open]")).toHaveCount(0);
    const headerHandle = steps.first().locator("summary .procedure-drag");
    await expect(headerHandle).toBeVisible();
    await headerHandle.click();
    await expect(page.locator(".procedure-step[open]")).toHaveCount(0);
    await steps
      .last()
      .locator("summary .procedure-drag")
      .dragTo(steps.first().locator("summary"));
    await expect(steps.first().locator("summary")).toContainText(
      "Record review result",
    );
    await expect(page.locator(".procedure-step[open]")).toHaveCount(0);
    await steps
      .first()
      .locator("summary .procedure-drag")
      .dragTo(steps.last().locator("summary"));
    await expect(steps.first().locator("summary")).toContainText(
      "Confirm document identity",
    );
    await expect(page.locator(".procedure-step[open]")).toHaveCount(0);
    await steps.nth(1).locator("summary").focus();
    await page.keyboard.press("Enter");
    await steps
      .nth(1)
      .getByLabel("Step title", { exact: true })
      .fill("Compare the approved label wording");
    await steps.nth(1).locator("summary").click();
    await expect(steps.nth(1).locator("summary")).toContainText(
      "Compare the approved label wording",
    );
    await steps.nth(1).locator("summary").click();
    await expect(
      steps.nth(1).getByLabel("Step title", { exact: true }),
    ).toHaveValue("Compare the approved label wording");
    await steps
      .nth(1)
      .getByRole("button", { name: "Move up", exact: true })
      .click();
    await expect(steps.first().locator("summary")).toContainText(
      "Compare the approved label wording",
    );
    await expect(steps.first()).toHaveAttribute("open", "");
    await page.getByRole("button", { name: "Expand all", exact: true }).click();
    await expect(page.locator(".procedure-step[open]")).toHaveCount(3);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Save draft", exact: true }),
    ).toBeDisabled();
    expect(saved?.expectedRevision).toBe(2);
    expect(
      (saved?.steps as { stepId: string }[]).map((step) => step.stepId),
    ).toEqual(["step-2", "step-1", "step-3"]);
    expect((saved?.steps as { title: string }[])[0].title).toBe(
      "Compare the approved label wording",
    );
    expect(saved?.citations).toEqual(definition.citations);
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await expect(steps).toHaveCount(4);
    await expect(steps.last()).toHaveAttribute("open", "");
    await expect(
      steps.last().getByLabel("Step title", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save draft", exact: true }),
    ).toBeDisabled();
    await steps
      .last()
      .getByRole("button", { name: "Remove step", exact: true })
      .click();
    await expect(steps).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await reviewPanel.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Collapse all", exact: true })
      .click();
    await expect(page.locator(".procedure-step[open]")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => window.document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-procedure-mobile-${theme}.png`),
    });
    await page.locator(".procedure-evidence").screenshot({
      path: join(tmpdir(), `patch-ui-procedure-evidence-mobile-${theme}.png`),
    });
    page.on("dialog", (dialog) => dialog.accept());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/projects/${projectId}/procedures`);
    await expect(
      page.getByRole("heading", { name: "Definitions and history" }),
    ).toBeVisible();
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-procedure-list-${theme}.png`),
    });
    await page.goto(
      `/projects/${projectId}/procedures/${procedureId}/runs/${runId}`,
    );
    await expect(
      page.getByRole("progressbar", { name: "Recorded step completion" }),
    ).toHaveAttribute("value", "0");
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-procedure-run-${theme}.png`),
    });
    expect(h.errors).toEqual([]);
    expect(h.unmatched).toEqual([]);
  });
}

test("procedure approval requires source acknowledgement; publication is separate", async ({
  page,
}) => {
  const h = await harness(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(
    `/projects/${projectId}/procedures/${procedureId}/edit?version=${definitionId}`,
  );
  await expect(
    page.getByRole("button", { name: "Owner approve" }),
  ).toBeDisabled();
  await page.getByLabel("Confirm the source label").check();
  await page.getByLabel(/I reviewed this saved definition/).check();
  await page.getByRole("button", { name: "Owner approve" }).click();
  await expect(
    page.getByRole("button", { name: "Publish approved version" }),
  ).toBeVisible();
  expect(h.writes[0].body).toEqual({
    expectedRevision: 2,
    confirmHumanReview: true,
    acknowledgedReasons: ["Confirm the source label"],
  });
  await page.getByRole("button", { name: "Publish approved version" }).click();
  await expect(page.getByLabel("Procedure title")).toBeDisabled();
  expect(h.writes[1].body).toEqual({ expectedRevision: 3 });
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});
test("severe review blockers cannot be approved or published", async ({
  page,
}) => {
  const h = await harness(page, { blocked: true });
  await page.goto(
    `/projects/${projectId}/procedures/${procedureId}/edit?version=${definitionId}`,
  );
  await expect(
    page.getByRole("button", { name: "Owner approve" }),
  ).toBeDisabled();
  await expect(
    page.getByLabel(/I reviewed this saved definition/),
  ).toBeDisabled();
  await expect(page.getByText("Missing current source")).toBeVisible();
  expect(h.writes).toEqual([]);
  expect(h.errors).toEqual([]);
});
test("run completion requires recorded required steps and uses run revisions", async ({
  page,
}) => {
  const h = await harness(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(
    `/projects/${projectId}/procedures/${procedureId}/runs/${runId}`,
  );
  await expect(
    page.getByRole("button", { name: "Complete run", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Completed (required)").click();
  await expect(page.getByLabel("Completed (required)")).toBeChecked();
  await page.getByRole("button", { name: "Complete run", exact: true }).click();
  await expect(page.getByLabel("Completed (required)")).toBeDisabled();
  expect(h.writes.map((w) => w.body.expectedRevision)).toEqual([1, 2]);
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});
test("Project Members cannot mutate logs or approve procedures", async ({
  page,
}) => {
  const h = await harness(page, { member: true });
  await page.goto(`/projects/${projectId}/maintenance-logs`);
  await expect(page.getByText(/Project Members can read logs/)).toBeVisible();
  await expect(page.getByRole("button", { name: "New log" })).toHaveCount(0);
  await page.goto(
    `/projects/${projectId}/procedures/${procedureId}/edit?version=${definitionId}`,
  );
  await expect(page.getByLabel("Procedure title")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Owner approve" })).toHaveCount(
    0,
  );
  expect(h.writes).toEqual([]);
  expect(h.errors).toEqual([]);
  expect(h.unmatched).toEqual([]);
});

test("current-access denial is visible without a fake successful edit", async ({
  page,
}) => {
  const h = await harness(page);
  await page.route(`**/api/equipments/${equipmentId}`, (route) =>
    route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page.goto(`/equipments/${equipmentId}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "You do not have access",
  );
  await expect(page.getByRole("button", { name: "Edit details" })).toHaveCount(
    0,
  );
  expect(h.errors).toEqual([]);
});
test("stale log revision keeps unsaved wording for recovery", async ({
  page,
}) => {
  const h = await harness(page);
  h.state.logs.push({
    id: "log-1",
    projectId,
    scopeType: "PROJECT",
    equipmentId: null,
    text: "Original observation",
    state: "DRAFT",
    revision: 1,
    attachmentVersionIds: [],
    citations: [],
    createdBy: owner,
    createdAt: now,
  });
  await page.route(
    `**/api/projects/${projectId}/maintenance-logs/log-1`,
    (route) =>
      route.fulfill({
        status: 409,
        json: { error: { code: "LOG_REVISION_CONFLICT" } },
      }),
  );
  await page.goto(`/projects/${projectId}/maintenance-logs`);
  await page.getByRole("button", { name: "Original observation" }).click();
  await page
    .getByLabel("Final user wording", { exact: false })
    .fill("Unsaved wording to preserve");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "record changed",
  );
  await expect(
    page.getByLabel("Final user wording", { exact: false }),
  ).toHaveValue("Unsaved wording to preserve");
  await expect(
    page.getByRole("button", { name: "Submit saved log" }),
  ).toBeDisabled();
  expect(h.errors).toEqual([]);
});
test("exact visual assets are authorized on demand and never proxied through Next images", async ({
  page,
}) => {
  const h = await harness(page);
  const assetId = "a".repeat(24);
  h.state.turns.push({
    id: "visual-turn",
    sessionId,
    clientTurnId: "326b8ef5-6fe9-4005-87eb-e49a68a157e8",
    question: "What does this label look like?",
    assignedReferences: [],
    state: "COMPLETED",
    result: {
      status: "approved",
      answer: { steps: [] },
      citations: [],
      warnings: [],
      routing: { selectedEntities: [] },
      visualEvidenceState: "AVAILABLE",
      visualObservations: [
        {
          text: "The diagram shows an amber test label.",
          visualCitationIds: ["v1"],
        },
      ],
      visualCitations: [
        {
          id: "v1",
          assetId,
          documentId,
          documentVersionId: versionId,
          page: 1,
          relevanceRole: "REQUIRED",
        },
      ],
      followUpAllowed: true,
    },
  });
  let sourceRequests = 0;
  await page.route(`**/api/visual-assets/${assetId}/source`, (route) => {
    sourceRequests++;
    return route.fulfill({
      json: {
        url: "https://storage.example.test/exact.png",
        expiresInSeconds: 300,
      },
    });
  });
  await page.route("https://storage.example.test/exact.png", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVQAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
  await page.goto(`/chat/${sessionId}`);
  await expect(
    page.getByText("The diagram shows an amber test label."),
  ).toBeVisible();
  expect(sourceRequests).toBe(0);
  await page.getByRole("button", { name: "Show exact image" }).click();
  await expect(
    page.getByRole("img", { name: /Verified visual/ }),
  ).toHaveAttribute("src", "https://storage.example.test/exact.png");
  expect(sourceRequests).toBe(1);
  await page.route(`**/api/visual-assets/${assetId}/source`, (route) =>
    route.fulfill({ status: 403, json: { error: { code: "SOURCE_REVOKED" } } }),
  );
  await page.getByRole("button", { name: "Refresh image access" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "do not have access",
  );
  await expect(page.getByRole("img", { name: /Verified visual/ })).toHaveCount(
    0,
  );
  expect(h.errors).toEqual([]);
});
test("an unavailable answer cannot render operational text or supplied visual observations", async ({
  page,
}) => {
  const h = await harness(page);
  h.state.turns.push({
    id: "unsafe-turn",
    sessionId,
    clientTurnId: "326b8ef5-6fe9-4005-87eb-e49a68a157e8",
    question: "A test question",
    assignedReferences: [],
    state: "COMPLETED",
    result: {
      status: "unavailable",
      answer: {
        steps: [
          {
            id: "unsafe",
            text: "Unverified operational text",
            citationIds: [],
          },
        ],
      },
      citations: [],
      warnings: ["Evidence unavailable"],
      routing: { selectedEntities: [] },
      visualEvidenceState: "UNAVAILABLE",
      visualObservations: [
        { text: "Unverified visual text", visualCitationIds: ["v1"] },
      ],
      visualCitations: [
        { id: "v1", assetId: "asset", page: 1, relevanceRole: "REQUIRED" },
      ],
      followUpAllowed: true,
    },
  });
  await page.goto(`/chat/${sessionId}`);
  await expect(
    page.getByText("Evidence unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Unverified operational text")).toHaveCount(0);
  await expect(page.getByText("Unverified visual text")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Evidence used", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show exact image" }),
  ).toHaveCount(0);
  expect(h.errors).toEqual([]);
});
test("tablet directory stays within the viewport and mobile navigation remains usable", async ({
  page,
}) => {
  const h = await harness(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/equipments");
  await expect(
    page.getByRole("link", { name: equipment.name, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => window.document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(h.errors).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  test(`polished lists, file picker and Chat stay readable in ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript(
      (choice) => localStorage.setItem("patch-theme", choice),
      theme,
    );
    const h = await harness(page);
    h.state.equipment.name = "PT-101 Header Pressure Sensor";
    h.state.document.title = "03_P101_Pump_Reference";
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const title = page.getByRole("link", {
      name: h.state.equipment.name,
      exact: true,
    });
    await expect(title).toBeVisible();
    expect((await title.boundingBox())!.width).toBeGreaterThan(180);
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-home-${theme}.png`),
    });
    await page.goto("/documents");
    await page
      .getByRole("button", { name: h.state.document.title, exact: true })
      .click();
    const revision = page.getByRole("link", {
      name: "Revision 1",
      exact: true,
    });
    await expect(revision).toBeVisible();
    expect((await revision.boundingBox())!.width).toBeGreaterThan(100);
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-documents-${theme}.png`),
    });
    await page
      .getByRole("button", { name: "Add new document", exact: true })
      .click();
    await page
      .getByLabel("Document title", { exact: false })
      .fill("Pump reference");
    await page.getByLabel("Original file", { exact: true }).setInputFiles({
      name: "pump-reference.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF synthetic UI fixture"),
    });
    await expect(
      page.getByText("pump-reference.pdf", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Original file", { exact: true }).focus();
    await expect(
      page.getByLabel("Original file", { exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Upload original", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-upload-${theme}.png`),
    });
    // No upload is submitted: this check covers selection and presentation only.
    h.state.turns.push({
      id: "visual-turn",
      sessionId,
      clientTurnId: "visual-client",
      question: "What does the pump reference describe?",
      assignedReferences: [{ type: "EQUIPMENT", id: equipmentId }],
      state: "COMPLETED",
      createdAt: now,
      result: {
        status: "approved",
        answer: {
          steps: [
            {
              id: "visual-step",
              text: "The synthetic reference describes a circulation pump and its connection to the header pressure sensor. Use the cited reference to compare document labels.",
              citationIds: [citation.id, "citation-2"],
            },
            {
              id: "connected-step",
              text: "The pump and sensor belong to the same fictional cooling-water project. Their shared document links keep the reference available from either Equipment.",
              citationIds: [citation.id],
            },
          ],
        },
        citations: [
          citation,
          {
            ...citation,
            id: "citation-2",
            documentTitle: "Synthetic project reference",
            chunkId: "project-chunk",
            page: 2,
          },
        ],
        warnings: [
          "This is a synthetic document review example; no physical work is represented.",
        ],
        routing: { selectedEntities: [] },
        visualEvidenceState: "TEXT_ONLY",
        followUpAllowed: true,
      },
    });
    await page.goto(`/chat/${sessionId}`);
    await expect(
      page.getByRole("button", { name: "Evidence used", exact: true }),
    ).toBeVisible();
    const passages = page.locator(".chat-answer-passage");
    await expect(passages).toHaveCount(2);
    await expect(passages.first().getByRole("button")).toHaveText(["1", "2"]);
    await expect(passages.last().getByRole("button")).toHaveText(["1"]);
    const marker = passages.first().getByRole("button", {
      name: `Source ${citation.id}`,
      exact: true,
    });
    await expect(marker).toHaveAttribute("title", citation.documentTitle);
    // The source number stays on the final text line, rather than adding a row.
    const inlineMarker = await passages.first().evaluate((passage) => {
      const text = passage.querySelector("p")!.firstChild!;
      const end = window.document.createRange();
      end.setStart(text, text.textContent!.length - 1);
      end.setEnd(text, text.textContent!.length);
      const textBox = end.getBoundingClientRect();
      const markerBox = passage
        .querySelector("button")!
        .getBoundingClientRect();
      return markerBox.top < textBox.bottom && markerBox.bottom > textBox.top;
    });
    expect(inlineMarker).toBe(true);
    await marker.focus();
    await expect(marker).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic project reference",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-chat-${theme}.png`),
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    expect(
      await page.evaluate(
        () => window.document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Question", { exact: true })).toBeVisible();
    await page.screenshot({
      path: join(tmpdir(), `patch-ui-tablet-${theme}.png`),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => window.document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Question", { exact: true })).toBeVisible();
    expect(h.writes).toEqual([]);
    expect(h.errors).toEqual([]);
    expect(h.unmatched).toEqual([]);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`Markdown Chat is organized, cited and safe in ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript(
      (choice) => localStorage.setItem("patch-theme", choice),
      theme,
    );
    const h = await harness(page);
    h.state.turns.push({
      id: "markdown-turn",
      sessionId,
      clientTurnId: "markdown-client",
      question: "Summarize the synthetic cooling-water reference.",
      assignedReferences: [],
      state: "COMPLETED",
      createdAt: now,
      result: {
        status: "approved",
        answer: {
          summary: null,
          steps: [
            {
              id: "overview",
              text: "## Cooling-water reference\n\nThe **circulation pump** belongs to a *fictional* monitoring project. Use `P-101` to identify its document record.",
              citationIds: [citation.id],
            },
            {
              id: "connections",
              text: "### Connected records\n\n- **P-101** — circulation pump\n- **VFD-101** — drive command\n- **PT-101** — header pressure\n\n| Record | Role |\n| --- | --- |\n| P-101 | Virtual circulation pump |\n| PT-101 | Virtual header-pressure signal |",
              citationIds: [citation.id],
            },
            {
              id: "flow",
              text: "### Reference flow\n\n```text\nTK-101 → P-101 → HDR-101\n```\n\n> This fixture describes software relationships; it provides no physical operating authority.",
              citationIds: [citation.id],
            },
          ],
        },
        citations: [citation],
        warnings: [],
        routing: { selectedEntities: [] },
        visualEvidenceState: "TEXT_ONLY",
        followUpAllowed: true,
      },
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(`/chat/${sessionId}`);
    await expect(
      page.getByRole("heading", { name: "Cooling-water reference" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveText(
      /Virtual circulation pump/,
    );
    await expect(page.locator(".chat-markdown ul li")).toHaveCount(3);
    await expect(page.locator(".chat-markdown ul")).toHaveCSS(
      "list-style-type",
      "disc",
    );
    await expect(page.locator(".chat-markdown pre code")).toHaveText(
      "TK-101 → P-101 → HDR-101\n",
    );
    await expect(
      page.getByRole("button", { name: `Source ${citation.id}`, exact: true }),
    ).toHaveCount(3);
    await page
      .getByRole("button", { name: `Source ${citation.id}`, exact: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: join(tmpdir(), `patch-chat-markdown-${theme}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => window.document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Question", { exact: true })).toBeVisible();
    expect(h.errors).toEqual([]);
    expect(h.unmatched).toEqual([]);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`PATCH record and help answers work without attachments in ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (choice) => localStorage.setItem("patch-theme", choice),
      theme,
    );
    const h = await harness(page);
    h.state.turns.push({
      id: "workspace-turn",
      sessionId,
      clientTurnId: "workspace-client",
      question: "Give me my Projects and related docs. How do I add a version?",
      assignedReferences: [],
      state: "COMPLETED",
      createdAt: now,
      result: {
        status: "approved",
        answerKind: "WORKSPACE",
        answer: { summary: null, steps: [] },
        citations: [],
        warnings: [],
        routing: { selectedEntities: [] },
        followUpAllowed: true,
        visualEvidenceState: "TEXT_ONLY",
        workspaceOverview: {
          scope: "WORKSPACE",
          catalog: {
            entities: [
              {
                id: projectId,
                type: "PROJECT",
                name: project.name,
                description: project.description,
                status: project.status,
                equipmentIds: [],
                attributes: {},
              },
            ],
            documents: [],
            partial: false,
            workflowRecords: [],
            help: [
              {
                id: "documents-v1",
                title: "Document revisions",
                text: "Use Add new version.",
              },
            ],
          },
          passages: [
            {
              text: "## Your Project\n\n**Integration inspection** is active. Its saved description is Synthetic inspection project.\n\n### Add a revision\n\nUse **Add new version** in Documents, then review the extraction before approval.",
              recordIds: ["entity:0", "help:0"],
            },
          ],
        },
      },
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/chat/${sessionId}`);
    await expect(
      page.getByRole("heading", { name: "Your Project" }),
    ).toBeVisible();
    await expect(
      page.getByText("workspace response", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Add new version", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Evidence used", exact: true }),
    ).toHaveCount(0);
    await page.getByText("Records and guidance used").click();
    await expect(
      page.getByRole("link", { name: project.name, exact: true }),
    ).toHaveAttribute("href", `/projects/${projectId}`);
    await page.screenshot({
      path: join(tmpdir(), `patch-chat-workspace-${theme}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => window.document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(h.errors).toEqual([]);
    expect(h.unmatched).toEqual([]);
  });
}
