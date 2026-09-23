import { api, post, patch, remove, items, id, ApiRequestError } from "./http";
import type {
  AI,
  DocumentRecord,
  DocumentLink,
  Entity,
  Source,
  Version,
} from "./contracts";

export const documentTypes = [
  "MANUAL",
  "TECHNICAL_PROCEDURE",
  "SAFETY_PROCEDURE",
  "PROJECT_DOCUMENT",
] as const;
export const getLibrary = () => items<DocumentRecord>("/api/documents");
export const getDocumentRecord = (key: string) =>
  api<DocumentRecord>(`/api/documents/${id(key)}`);
export const getVersions = (key: string) =>
  items<Version>(`/api/documents/${id(key)}/versions`);
export const getVersion = (key: string) =>
  api<Version>(`/api/document-versions/${id(key)}`);
export const getSource = (key: string) =>
  api<Source>(`/api/document-versions/${id(key)}/source`);
export const entityDocumentPath = (entity: Entity) =>
  `/api/${entity.type === "PROJECT" ? "projects" : "equipments"}/${id(entity.id)}/documents`;
export const getEntityDocuments = (entity: Entity) =>
  api<{ items: DocumentRecord[]; links: DocumentLink[] }>(
    entityDocumentPath(entity),
  );
export const linkDocument = (entity: Entity, documentId: string) =>
  post(entityDocumentPath(entity), { documentId });
export const unlinkDocument = (entity: Entity, documentId: string) =>
  remove(`${entityDocumentPath(entity)}/${id(documentId)}`);
export const archiveDocument = (documentId: string, archived: boolean) =>
  patch<DocumentRecord>(`/api/documents/${id(documentId)}`, { archived });
export const reviewDocument = (
  versionId: string,
  body: {
    decision: "APPROVE" | "REJECT";
    title: string;
    revision: string;
    confirmSourceReviewed: true;
  },
) => post(`/api/document-versions/${id(versionId)}/review`, body);
export const completeUpload = (versionId: string) =>
  post(`/api/document-versions/${id(versionId)}/complete-upload`);
export const activateDocument = (versionId: string) =>
  post(`/api/document-versions/${id(versionId)}/activate`);

export type UploadSession = {
  documentId: string;
  documentVersionId: string;
  uploadUrl: string;
  headers: Record<string, string>;
};
export class UploadInterrupted extends ApiRequestError {
  constructor(
    public session: UploadSession,
    public bytesUploaded: boolean,
  ) {
    super(
      bytesUploaded ? "UPLOAD_FINALIZATION_PENDING" : "UPLOAD_TRANSFER_FAILED",
    );
  }
}
export function fileContentType(file: File) {
  const types: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const type = types[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type || !file.size || file.size > 52_428_800)
    throw new ApiRequestError("UPLOAD_REJECTED");
  return type;
}
export async function transferUpload(session: UploadSession, file: File) {
  let uploaded = false;
  try {
    const result = await fetch(session.uploadUrl, {
      method: "PUT",
      body: file,
      headers: session.headers,
      credentials: "omit",
      redirect: "error",
    });
    if (!result.ok) throw new ApiRequestError("UPLOAD_TRANSFER_FAILED");
    uploaded = true;
    await completeUpload(session.documentVersionId);
    return session;
  } catch {
    throw new UploadInterrupted(session, uploaded);
  }
}
export async function uploadDocument(
  file: File,
  input: {
    title: string;
    documentType: (typeof documentTypes)[number];
    entity: Entity;
    documentId?: string;
  },
) {
  const contentType = fileContentType(file);
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const metadata = { contentType, bytes: file.size, sha256 };
  const session = await post<UploadSession>(
    input.documentId
      ? `/api/documents/${id(input.documentId)}/versions`
      : "/api/documents/upload-sessions",
    input.documentId
      ? metadata
      : {
          ...metadata,
          title: input.title,
          documentType: input.documentType,
          entity: input.entity,
        },
  );
  return transferUpload(session, file);
}
export type VisualAsset = {
  id: string;
  page: number;
  state: string;
  descriptionState: string;
  indexState: string;
  metadata?: AI["VisualSourceAsset"];
  description?: AI["VisualDescription"] | null;
};
export const getVisuals = (versionId: string) =>
  items<VisualAsset>(`/api/document-versions/${id(versionId)}/visual-assets`);
export const getVisualSource = (assetId: string) =>
  api<Source>(`/api/visual-assets/${id(assetId)}/source`);
export const discoverVisuals = (versionId: string) =>
  post(`/api/document-versions/${id(versionId)}/visual-discovery`);
export const discoveryStatus = (versionId: string) =>
  api<{
    status: string;
    partial?: boolean;
    scannedPages?: number;
    candidatePages?: number[];
  }>(`/api/document-versions/${id(versionId)}/visual-discovery`);
export const renderVisual = (versionId: string, page: number) =>
  post(`/api/document-versions/${id(versionId)}/visual-assets`, { page });
export const describeVisual = (assetId: string) =>
  post(`/api/visual-assets/${id(assetId)}/describe`);
