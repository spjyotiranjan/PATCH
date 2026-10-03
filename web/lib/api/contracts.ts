import type { components } from "@/lib/ai/generated";
export type AI = components["schemas"];
export type Entity = { type: "PERSONAL" | "PROJECT" | "EQUIPMENT"; id: string };
export type EquipmentRecord = {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  model: string | null;
  location: string;
  description: string | null;
  operationalState: "UNKNOWN" | "OPERATING" | "MAINTENANCE" | "OUT_OF_SERVICE";
  documentsMode: "ADD_NOW" | "SKIP_FOR_NOW";
  accessLevel: "OWNER" | "MANAGER";
  createdAt: string;
  updatedAt: string;
};
export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  includedEquipmentIds: string[];
  role: "OWNER" | "MEMBER";
  procedureGenerationStatus:
    "WAITING_FOR_SOURCES" | "QUEUED" | "GENERATING" | "READY" | "FAILED";
  createdAt: string;
  updatedAt: string;
};
export type Discovery = {
  id: string;
  name: string;
  type?: string;
  location?: string;
  status?: ProjectRecord["status"];
  accessRequestStatus: "NONE" | "PENDING" | "REJECTED";
};
export type AccessRequest = {
  id: string;
  resourceId: string;
  requesterId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};
export type Profile = {
  state: "MISSING" | "FRESH" | "STALE" | "FAILED";
  result?: AI["EntityProfileResult"];
};
export type DocumentRecord = {
  id: string;
  ownerId: string;
  title: string;
  documentType: string;
  origin: Entity;
  activeVersionId: string | null;
  nextVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};
export type Version = {
  id: string;
  documentId: string;
  versionNumber: number;
  contentType: string;
  bytes: number;
  sha256: string;
  state:
    | "UPLOADING"
    | "FINALIZING"
    | "EXTRACTING"
    | "NEEDS_REVIEW"
    | "INDEXING"
    | "INDEXED"
    | "ACTIVE"
    | "SUPERSEDED"
    | "FAILED";
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
  extraction?: AI["ExtractResult"];
  reviewedMetadata?: AI["ReviewedMetadata"];
  previousActiveVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type DocumentLink = {
  id: string;
  documentId: string;
  entity: Entity;
  versionPolicy: "LATEST_APPROVED" | "PINNED";
  pinnedDocumentVersionId: string | null;
};
export type Source = {
  url: string;
  expiresIn?: number;
  expiresInSeconds?: number;
  contentType?: string;
};
export type Session = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
export type Turn = {
  id: string;
  sessionId: string;
  clientTurnId: string;
  question: string;
  assignedReferences: AI["AssignedReference"][];
  state: "PENDING" | "COMPLETED";
  result?: AI["QuestionResult"];
  createdAt: string;
};
export type Log = {
  id: string;
  projectId: string;
  createdBy: string;
  scopeType: "PROJECT" | "EQUIPMENT";
  equipmentId: string | null;
  text: string;
  attachmentVersionIds: string[];
  citations: AI["Citation"][];
  state: "DRAFT" | "SUBMITTED";
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type Schedule = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  timezone: string;
  localStart: string;
};
export type ProcedureRecord = {
  id: string;
  projectId: string;
  title: string;
  currentPublishedVersionId: string | null;
  schedule?: Schedule;
  createdAt: string;
};
export type ProcedureVersion = {
  id: string;
  projectId: string;
  procedureId: string;
  versionNumber: number;
  state: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED";
  revision: number;
  title: string;
  steps: (AI["ProcedureStep"] & {
    citationReviewState: "CONFIRMED" | "NEEDS_REVIEW";
  })[];
  citations: AI["Citation"][];
  reviewAnalysis: AI["ReviewAnalysis"];
  createdAt: string;
  updatedAt: string;
};
export type Run = {
  id: string;
  projectId: string;
  procedureId: string;
  procedureVersionId: string;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  state: "OPEN" | "COMPLETED";
  revision: number;
  steps: {
    stepId: string;
    required: boolean;
    checked: boolean;
    note: string;
    exception: string | null;
    actorId: string | null;
    updatedAt: string | null;
  }[];
  completedAt?: string;
};
