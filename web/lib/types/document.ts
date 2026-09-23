export type DocumentStatus =
  | "UPLOADING"
  | "EXTRACTING"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "INDEXING"
  | "ACTIVE"
  | "FAILED"
  | "REJECTED"
  | "SUPERSEDED"
  | "ARCHIVED";

export type DocumentSource = "DIRECT" | "INHERITED";

export type DocumentVersion = {
  id: string;
  documentId: string;
  version: string;
  filename: string;
  fileSize: string;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  changeSummary?: string;
  coveragePct: number | null;
};

export type Document = {
  id: string;
  title: string;
  docType: string;
  activeVersionId: string | null;
  activeVersion: string | null;
  status: DocumentStatus;
  equipmentId: string | null;
  equipmentName: string | null;
  projectId: string | null;
  source: DocumentSource;
  versions: DocumentVersion[];
  updatedAt: string;
  uploadedBy: string;
};

export type ProcessingQueueItem = {
  id: string;
  documentId: string;
  documentTitle: string;
  filename: string;
  status: DocumentStatus;
  equipmentName?: string;
  projectName?: string;
  startedAt: string;
  estimatedCompletionAt?: string;
  errorMessage?: string;
};
