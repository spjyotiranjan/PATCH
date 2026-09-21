import type {
  Procedure,
  ProcedureRun,
} from "@/lib/types/procedure";

/* ------------------------------------------------------------------ */
/* Stable mock data                                                     */
/* ------------------------------------------------------------------ */

let procedures: Procedure[] = [
  {
    id: "proc-1",
    projectId: "prj-001",
    title: "Boiler Startup Procedure",
    description:
      "Controlled startup sequence for Boiler B-201 after maintenance.",
    status: "PUBLISHED",
    version: 3,
    reviewNeed: "LOW",
    equipmentId: "eq-002",
    equipmentName: "Boiler B-201",
    steps: [
      {
        id: "step-1-1",
        procedureId: "proc-1",
        order: 1,
        title: "Verify isolation valves",
        instructions:
          "Confirm all feedwater isolation valves are open per the operations manual.",
        required: true,
        citationId: "ev-1",
        citationLabel:
          "Boiler Operations Manual · Rev. 4.2 · p.42",
        state: "GENERATED",
      },
      {
        id: "step-1-2",
        procedureId: "proc-1",
        order: 2,
        title: "Inspect pump suction",
        instructions:
          "Check pump suction conditions and record pressure readings.",
        required: true,
        citationId: "ev-2",
        citationLabel:
          "Boiler Maintenance Procedure · Rev. 3.1 · p.18",
        state: "GENERATED",
      },
    ],
    warnings: [
      "Verify zero-energy state before touching rotating equipment.",
    ],
    requiredPPE: [
      "Safety glasses",
      "Gloves",
      "Hard hat",
    ],
    references: [
      "Boiler Operations Manual · Rev. 4.2",
    ],
    generatedAt: "2026-05-10T09:00:00Z",
    publishedAt: "2026-05-13T10:00:00Z",
    publishedBy: "Mark Stevens",
    approvedBy: "David Wilson",
    createdAt: "2026-05-10T09:00:00Z",
    updatedAt: "2026-05-13T10:00:00Z",
  },
  {
    id: "proc-2",
    projectId: "prj-001",
    title: "Boiler feed pump vibration check",
    description:
      "Acoustic and triaxial vibration analysis draft pending source review.",
    status: "DRAFT",
    version: 1,
    reviewNeed: "HIGH",
    equipmentId: "eq-001",
    equipmentName: "Boiler Feed Pump P-101",
    steps: [
      {
        id: "step-2-1",
        procedureId: "proc-2",
        order: 1,
        title: "Close fuel supply",
        instructions:
          "Close the burner fuel supply valve and confirm shutoff.",
        required: true,
        citationId: null,
        citationLabel: null,
        state: "CITATION_NEEDS_REVIEW",
      },
    ],
    warnings: [],
    requiredPPE: ["Gloves", "Face shield"],
    references: [],
    generatedAt: "2026-05-14T09:00:00Z",
    publishedAt: null,
    publishedBy: null,
    approvedBy: null,
    createdAt: "2026-05-14T09:00:00Z",
    updatedAt: "2026-05-14T09:30:00Z",
  },
  {
    id: "proc-3",
    projectId: "prj-001",
    title: "Safety valve pop test and reseat inspection",
    description:
      "Draft blocked by missing approved source coverage for setpoint verification.",
    status: "NEEDS_REVIEW",
    version: 1,
    reviewNeed: "SEVERE",
    equipmentId: "eq-002",
    equipmentName: "Boiler B-201",
    steps: [
      {
        id: "step-3-1",
        procedureId: "proc-3",
        order: 1,
        title: "Verify setpoint against approved source",
        instructions:
          "Blocked: no current approved source covers the relief setpoint.",
        required: true,
        citationId: null,
        citationLabel: null,
        state: "CITATION_NEEDS_REVIEW",
      },
    ],
    warnings: [
      "Do not lift the valve without an approved setpoint reference.",
    ],
    requiredPPE: ["Gloves", "Face shield", "Hearing protection"],
    references: [],
    generatedAt: "2026-05-15T09:00:00Z",
    publishedAt: null,
    publishedBy: null,
    approvedBy: null,
    createdAt: "2026-05-15T09:00:00Z",
    updatedAt: "2026-05-15T09:30:00Z",
  },
  {
    id: "proc-waiting-1",
    projectId: "prj-003",
    title: "Pending procedure generation",
    description:
      "Generation is waiting for the required description and at least one approved direct project source.",
    status: "WAITING_FOR_SOURCES",
    version: 0,
    reviewNeed: null,
    equipmentId: null,
    equipmentName: null,
    steps: [],
    warnings: [],
    requiredPPE: [],
    references: [],
    generatedAt: null,
    publishedAt: null,
    publishedBy: null,
    approvedBy: null,
    createdAt: "2026-06-01T08:30:00Z",
    updatedAt: "2026-09-19T09:00:00Z",
  },
];

let runs: ProcedureRun[] = [
  {
    id: "run-1",
    procedureId: "proc-1",
    procedureTitle: "Boiler Startup Procedure",
    version: 3,
    status: "COMPLETED",
    period: "2026-09-01 → 2026-09-07",
    steps: [
      {
        id: "runstep-1-1",
        runId: "run-1",
        stepId: "step-1-1",
        order: 1,
        title: "Verify isolation valves",
        instructions:
          "Confirm all feedwater isolation valves are open per the operations manual.",
        required: true,
        status: "COMPLETED",
        completedBy: "James Miller",
        completedAt: "2026-09-02T09:15:00Z",
        note: null,
      },
      {
        id: "runstep-1-2",
        runId: "run-1",
        stepId: "step-1-2",
        order: 2,
        title: "Inspect pump suction",
        instructions:
          "Check pump suction conditions and record pressure readings.",
        required: true,
        status: "COMPLETED",
        completedBy: "James Miller",
        completedAt: "2026-09-02T09:40:00Z",
        note: "Suction pressure nominal at 4.1 bar.",
      },
    ],
    scheduledAt: "2026-09-01T06:00:00Z",
    startedAt: "2026-09-02T09:00:00Z",
    completedAt: "2026-09-02T09:45:00Z",
    completedBy: "James Miller",
  },
  {
    id: "run-2",
    procedureId: "proc-1",
    procedureTitle: "Boiler Startup Procedure",
    version: 3,
    status: "IN_PROGRESS",
    period: "2026-09-08 → 2026-09-14",
    steps: [
      {
        id: "runstep-2-1",
        runId: "run-2",
        stepId: "step-1-1",
        order: 1,
        title: "Verify isolation valves",
        instructions:
          "Confirm all feedwater isolation valves are open per the operations manual.",
        required: true,
        status: "PENDING",
        completedBy: null,
        completedAt: null,
        note: null,
      },
      {
        id: "runstep-2-2",
        runId: "run-2",
        stepId: "step-1-2",
        order: 2,
        title: "Inspect pump suction",
        instructions:
          "Check pump suction conditions and record pressure readings.",
        required: true,
        status: "PENDING",
        completedBy: null,
        completedAt: null,
        note: null,
      },
    ],
    scheduledAt: "2026-09-08T06:00:00Z",
    startedAt: null,
    completedAt: null,
    completedBy: null,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function delay(ms: number) {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, ms),
  );
}

/* ------------------------------------------------------------------ */
/* Procedure operations                                                 */
/* ------------------------------------------------------------------ */

export async function mockGetProcedures(
  projectId: string,
): Promise<Procedure[]> {
  await delay(300);
  return procedures.filter(
    (procedure) =>
      procedure.projectId === projectId,
  );
}

export async function mockGetProcedure(
  procedureId: string,
): Promise<Procedure | null> {
  await delay(200);
  return (
    procedures.find(
      (procedure) =>
        procedure.id === procedureId,
    ) ?? null
  );
}

export async function mockGenerateProcedure(
  projectId: string,
  title: string,
): Promise<Procedure> {
  // Simulated generation workflow: QUEUED → GENERATING → DRAFT.
  await delay(1200);
  const now = new Date().toISOString();
  const procedure: Procedure = {
    id: `proc-${Date.now()}`,
    projectId,
    title,
    description:
      "Generated draft awaiting human review.",
    status: "DRAFT",
    version: 1,
    reviewNeed: "MODERATE",
    equipmentId: null,
    equipmentName: null,
    steps: [
      {
        id: `step-${Date.now()}-1`,
        procedureId: `proc-${Date.now()}`,
        order: 1,
        title: "Review applicable sources",
        instructions:
          "Confirm the cited sources cover this task before editing steps.",
        required: true,
        citationId: "ev-1",
        citationLabel:
          "Boiler Operations Manual · Rev. 4.2 · p.42",
        state: "GENERATED",
      },
    ],
    warnings: [],
    requiredPPE: [],
    references: [
      "Boiler Operations Manual · Rev. 4.2",
    ],
    generatedAt: now,
    publishedAt: null,
    publishedBy: null,
    approvedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  procedures = [procedure, ...procedures];
  return procedure;
}

export async function mockUpdateProcedure(
  procedureId: string,
  patch: Partial<
    Pick<
      Procedure,
      "title" | "description" | "steps"
    >
  >,
): Promise<Procedure | null> {
  await delay(400);
  const existing = procedures.find(
    (procedure) => procedure.id === procedureId,
  );
  if (!existing) {
    return null;
  }
  const updated: Procedure = {
    ...existing,
    ...patch,
    steps: patch.steps
      ? patch.steps.map((step) => ({
          ...step,
          state:
            step.state === "GENERATED"
              ? ("CITATION_NEEDS_REVIEW" as const)
              : step.state,
        }))
      : existing.steps,
    status:
      existing.status === "PUBLISHED"
        ? "DRAFT"
        : existing.status,
    updatedAt: new Date().toISOString(),
  };
  procedures = procedures.map((procedure) =>
    procedure.id === procedureId
      ? updated
      : procedure,
  );
  return updated;
}

export async function mockPublishProcedure(
  procedureId: string,
): Promise<Procedure | null> {
  await delay(500);
  const existing = procedures.find(
    (procedure) => procedure.id === procedureId,
  );
  if (!existing) {
    return null;
  }
  if (existing.reviewNeed === "SEVERE") {
    throw new Error(
      "SEVERE_BLOCKER: resolve blocking findings before publishing.",
    );
  }
  const published: Procedure = {
    ...existing,
    status: "PUBLISHED",
    publishedAt: new Date().toISOString(),
    publishedBy: "Alex Morgan",
    updatedAt: new Date().toISOString(),
  };
  procedures = procedures.map((procedure) =>
    procedure.id === procedureId
      ? published
      : procedure,
  );
  return published;
}

/* ------------------------------------------------------------------ */
/* Run operations                                                       */
/* ------------------------------------------------------------------ */

export async function mockGetProcedureRuns(
  procedureId: string,
): Promise<ProcedureRun[]> {
  await delay(250);
  return runs.filter(
    (run) => run.procedureId === procedureId,
  );
}

export async function mockGetProcedureRun(
  runId: string,
): Promise<ProcedureRun | null> {
  await delay(200);
  return (
    runs.find((run) => run.id === runId) ??
    null
  );
}

export async function mockCompleteRunStep(
  runId: string,
  stepId: string,
  note?: string,
): Promise<ProcedureRun | null> {
  await delay(300);
  const existing = runs.find(
    (run) => run.id === runId,
  );
  if (!existing) {
    return null;
  }
  const now = new Date().toISOString();
  const updated: ProcedureRun = {
    ...existing,
    status: "IN_PROGRESS",
    startedAt: existing.startedAt ?? now,
    steps: existing.steps.map((step) =>
      step.stepId === stepId
        ? {
            ...step,
            status: "COMPLETED" as const,
            completedBy: "Alex Morgan",
            completedAt: now,
            note: note ?? step.note,
          }
        : step,
    ),
  };
  const allRequiredDone = updated.steps
    .filter((step) => step.required)
    .every(
      (step) => step.status === "COMPLETED",
    );
  if (allRequiredDone) {
    updated.status = "COMPLETED";
    updated.completedAt = now;
    updated.completedBy = "Alex Morgan";
  }
  runs = runs.map((run) =>
    run.id === runId ? updated : run,
  );
  return updated;
}
