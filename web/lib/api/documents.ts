import type {
  Document,
  DocumentVersion,
  ProcessingQueueItem,
} from "@/lib/types/document";

import {
  mockAddDocumentVersion,
  mockGetDocument,
  mockGetDocumentVersions,
  mockGetDocuments,
  mockGetEquipmentDocuments,
  mockGetProcessingQueue,
  mockGetProjectDocuments,
} from "@/lib/mockapi/documents";

/**
 * Document service boundary.
 *
 * UI code consumes these functions. A future real backend replaces
 * the mock implementation inside this module without touching pages
 * or components.
 */

export async function getDocuments(): Promise<
  Document[]
> {
  return mockGetDocuments();
}

export async function getDocument(
  id: string,
): Promise<Document | null> {
  return mockGetDocument(id);
}

export async function getDocumentVersions(
  documentId: string,
): Promise<DocumentVersion[]> {
  return mockGetDocumentVersions(documentId);
}

export async function getEquipmentDocuments(
  equipmentId: string,
): Promise<Document[]> {
  return mockGetEquipmentDocuments(equipmentId);
}

export async function getProjectDocuments(
  projectId: string,
): Promise<Document[]> {
  return mockGetProjectDocuments(projectId);
}

export async function getProcessingQueue(): Promise<
  ProcessingQueueItem[]
> {
  return mockGetProcessingQueue();
}

export async function addDocumentVersion(
  documentId: string,
  filename: string,
): Promise<DocumentVersion> {
  return mockAddDocumentVersion(
    documentId,
    filename,
  );
}
