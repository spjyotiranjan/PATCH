import type { ObjectId } from "mongodb";
import type { components } from "@/lib/ai/generated";
import type { Entity } from "./context";
export type Schema = components["schemas"];
export interface DocumentRecord {
  archivedAt?: Date | null;
  _id: ObjectId;
  tenantId: string;
  ownerId: string;
  title: string;
  documentType: string;
  origin: Entity;
  activeVersionId: string | null;
  nextVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface VersionRecord {
  _id: ObjectId;
  tenantId: string;
  documentId: string;
  versionNumber: number;
  objectKey: string;
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
  uploadExpiresAt: Date;
  uploadCompletedAt?: Date;
  extraction?: Schema["ExtractResult"];
  reviewedMetadata?: Schema["ReviewedMetadata"];
  index?: Schema["IndexResult"];
  previousActiveVersionId: string | null;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface LinkRecord {
  _id: ObjectId;
  tenantId: string;
  entity: Entity;
  documentId: string;
  versionPolicy: "LATEST_APPROVED" | "PINNED";
  pinnedDocumentVersionId: string | null;
  reason: string | null;
  createdAt: Date;
}
export interface ProfileRecord {
  _id: ObjectId;
  tenantId: string;
  entityType: "PROJECT" | "EQUIPMENT";
  entityId: string;
  revision: number;
  state: "FRESH" | "STALE" | "FAILED";
  result?: Schema["EntityProfileResult"];
}
