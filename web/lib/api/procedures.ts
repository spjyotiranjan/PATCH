import type {
  Procedure,
  ProcedureRun,
} from "@/lib/types/procedure";

import {
  mockCompleteRunStep,
  mockGenerateProcedure,
  mockGetProcedure,
  mockGetProcedureRun,
  mockGetProcedureRuns,
  mockGetProcedures,
  mockPublishProcedure,
  mockUpdateProcedure,
} from "@/lib/mockapi/procedures";

/**
 * Procedure service boundary.
 *
 * UI code consumes these functions. A future real backend replaces
 * the mock implementation inside this module without touching pages
 * or components.
 */

export async function getProcedures(
  projectId: string,
): Promise<Procedure[]> {
  return mockGetProcedures(projectId);
}

export async function getProcedure(
  procedureId: string,
): Promise<Procedure | null> {
  return mockGetProcedure(procedureId);
}

export async function generateProcedure(
  projectId: string,
  title: string,
): Promise<Procedure> {
  return mockGenerateProcedure(
    projectId,
    title,
  );
}

export async function updateProcedure(
  procedureId: string,
  patch: Partial<
    Pick<
      Procedure,
      "title" | "description" | "steps"
    >
  >,
): Promise<Procedure | null> {
  return mockUpdateProcedure(
    procedureId,
    patch,
  );
}

export async function publishProcedure(
  procedureId: string,
): Promise<Procedure | null> {
  return mockPublishProcedure(procedureId);
}

export async function getProcedureRuns(
  procedureId: string,
): Promise<ProcedureRun[]> {
  return mockGetProcedureRuns(procedureId);
}

export async function getProcedureRun(
  runId: string,
): Promise<ProcedureRun | null> {
  return mockGetProcedureRun(runId);
}

export async function completeRunStep(
  runId: string,
  stepId: string,
  note?: string,
): Promise<ProcedureRun | null> {
  return mockCompleteRunStep(
    runId,
    stepId,
    note,
  );
}
