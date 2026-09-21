export type ProcedureStatus =
  | "WAITING_FOR_SOURCES"
  | "QUEUED"
  | "GENERATING"
  | "DRAFT"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "FAILED";

export type ReviewNeed = "LOW" | "MODERATE" | "HIGH" | "SEVERE";

export type ProcedureStepState =
  | "GENERATED"
  | "EDITED"
  | "CITATION_NEEDS_REVIEW";

export type ProcedureStep = {
  id: string;
  procedureId: string;
  order: number;
  title: string;
  instructions: string;
  required: boolean;
  citationId: string | null;
  citationLabel: string | null;
  state: ProcedureStepState;
};

export type Procedure = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: ProcedureStatus;
  version: number;
  reviewNeed: ReviewNeed | null;
  equipmentId: string | null;
  equipmentName: string | null;
  steps: ProcedureStep[];
  warnings: string[];
  requiredPPE: string[];
  references: string[];
  generatedAt: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  recurrence?: ProcedureRecurrence;
};

export type ProcedureRecurrence = {
  cadence: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  assignedTo: string | null;
  nextRunAt: string;
};

export type RunStepStatus = "PENDING" | "COMPLETED" | "SKIPPED";

export type ProcedureRunStep = {
  id: string;
  runId: string;
  stepId: string;
  order: number;
  title: string;
  instructions: string;
  required: boolean;
  status: RunStepStatus;
  completedBy: string | null;
  completedAt: string | null;
  note: string | null;
};

export type RunStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "OVERDUE";

export type ProcedureRun = {
  id: string;
  procedureId: string;
  procedureTitle: string;
  version: number;
  status: RunStatus;
  period: string;
  steps: ProcedureRunStep[];
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
};
