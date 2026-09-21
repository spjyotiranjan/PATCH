import type {
  Document,
  DocumentVersion,
  ProcessingQueueItem,
} from "@/lib/types/document";

/* ------------------------------------------------------------------ */
/* Stable mock data                                                     */
/* ------------------------------------------------------------------ */

const versions: DocumentVersion[] = [
  {
    id: "ver-doc-1-v32",
    documentId: "doc-1",
    version: "v3.2",
    filename: "P-101-OMM-2025.pdf",
    fileSize: "14.2 MB",
    status: "ACTIVE",
    uploadedBy: "Alex Morgan",
    uploadedAt: "2026-05-10T09:00:00Z",
    approvedBy: "Sarah Wilson",
    approvedAt: "2026-05-11T10:00:00Z",
    changeSummary:
      "Revised seal inspection intervals and updated torque tables.",
    coveragePct: 94,
  },
  {
    id: "ver-doc-1-v31",
    documentId: "doc-1",
    version: "v3.1",
    filename: "P-101-OMM-2024.pdf",
    fileSize: "13.8 MB",
    status: "SUPERSEDED",
    uploadedBy: "Alex Morgan",
    uploadedAt: "2025-01-14T09:00:00Z",
    approvedBy: "Sarah Wilson",
    approvedAt: "2025-01-15T10:00:00Z",
    changeSummary: "Annual review with corrected wiring diagrams.",
    coveragePct: 91,
  },
  {
    id: "ver-doc-2-v20",
    documentId: "doc-2",
    version: "v2.0",
    filename: "PID-P101-002-REV2.pdf",
    fileSize: "8.5 MB",
    status: "NEEDS_REVIEW",
    uploadedBy: "Sarah Chen",
    uploadedAt: "2026-05-12T09:00:00Z",
    changeSummary: "Added utility cooling water branch line.",
    coveragePct: 82,
  },
  {
    id: "ver-doc-3-v11",
    documentId: "doc-3",
    version: "v1.1",
    filename: "MSIG-P101-V11.pdf",
    fileSize: "3.4 MB",
    status: "INDEXING",
    uploadedBy: "David Kim",
    uploadedAt: "2026-05-14T09:00:00Z",
    changeSummary: "Expanded seal failure-mode coverage.",
    coveragePct: null,
  },
  {
    id: "ver-doc-4-v12",
    documentId: "doc-4",
    version: "v1.2",
    filename: "HX-202-TDS.pdf",
    fileSize: "5.4 MB",
    status: "ACTIVE",
    uploadedBy: "System",
    uploadedAt: "2026-02-18T09:00:00Z",
    approvedBy: "Sarah Wilson",
    approvedAt: "2026-02-19T10:00:00Z",
    changeSummary: "Updated thermal specification tables.",
    coveragePct: 91,
  },
  {
    id: "ver-doc-5-v40",
    documentId: "doc-5",
    version: "v4.0",
    filename: "PLANT-SAFETY-STD-2024.pdf",
    fileSize: "18.6 MB",
    status: "ACTIVE",
    uploadedBy: "Safety Office",
    uploadedAt: "2026-01-10T09:00:00Z",
    approvedBy: "Safety Office",
    approvedAt: "2026-01-12T10:00:00Z",
    changeSummary: "2024 pressure-vessel compliance revision.",
    coveragePct: 99,
  },
  {
    id: "ver-doc-6-v10",
    documentId: "doc-6",
    version: "v1.0",
    filename: "VS-TELEMETRY-SETUP.pdf",
    fileSize: "1.8 MB",
    status: "FAILED",
    uploadedBy: "David Kim",
    uploadedAt: "2026-05-14T09:00:00Z",
    changeSummary: "Initial telemetry setup guide upload.",
    coveragePct: null,
  },
  {
    id: "ver-pdoc-1-v20",
    documentId: "pdoc-1",
    version: "v2.0",
    filename: "PRJ-2025-PEP-V2.pdf",
    fileSize: "6.8 MB",
    status: "ACTIVE",
    uploadedBy: "Alex Morgan",
    uploadedAt: "2026-05-01T09:00:00Z",
    approvedBy: "Mark Stevens",
    approvedAt: "2026-05-02T10:00:00Z",
    changeSummary: "Scope of work revision 2.",
    coveragePct: 96,
  },
];

let documents: Document[] = [
  {
    id: "doc-1",
    title:
      "Centrifugal Pump P-101 Operation & Maintenance Manual",
    docType: "Manual",
    activeVersionId: "ver-doc-1-v32",
    activeVersion: "v3.2",
    status: "ACTIVE",
    equipmentId: "eq-001",
    equipmentName: "Centrifugal Pump P-101",
    projectId: null,
    source: "DIRECT",
    versions: versions.filter(
      (v) => v.documentId === "doc-1",
    ),
    updatedAt: "2026-05-10T09:00:00Z",
    uploadedBy: "Alex Morgan",
  },
  {
    id: "doc-2",
    title:
      "P&ID Diagram P-101-002 (Utility Cooling Water)",
    docType: "P&ID",
    activeVersionId: null,
    activeVersion: "v2.0",
    status: "NEEDS_REVIEW",
    equipmentId: "eq-001",
    equipmentName: "Centrifugal Pump P-101",
    projectId: null,
    source: "DIRECT",
    versions: versions.filter(
      (v) => v.documentId === "doc-2",
    ),
    updatedAt: "2026-05-12T09:00:00Z",
    uploadedBy: "Sarah Chen",
  },
  {
    id: "doc-3",
    title:
      "Mechanical Seal Installation & Maintenance Guide",
    docType: "Manual",
    activeVersionId: null,
    activeVersion: "v1.1",
    status: "INDEXING",
    equipmentId: "eq-001",
    equipmentName: "Centrifugal Pump P-101",
    projectId: null,
    source: "DIRECT",
    versions: versions.filter(
      (v) => v.documentId === "doc-3",
    ),
    updatedAt: "2026-05-14T09:00:00Z",
    uploadedBy: "David Kim",
  },
  {
    id: "doc-4",
    title:
      "Heat Exchanger HX-202 Datasheet & Thermal Specification",
    docType: "Datasheet",
    activeVersionId: "ver-doc-4-v12",
    activeVersion: "v1.2",
    status: "ACTIVE",
    equipmentId: "eq-002",
    equipmentName: "Boiler B-201",
    projectId: null,
    source: "DIRECT",
    versions: versions.filter(
      (v) => v.documentId === "doc-4",
    ),
    updatedAt: "2026-02-18T09:00:00Z",
    uploadedBy: "System",
  },
  {
    id: "doc-5",
    title:
      "Plant Safety Standards & Pressure Vessel Compliance 2024",
    docType: "Safety",
    activeVersionId: "ver-doc-5-v40",
    activeVersion: "v4.0",
    status: "ACTIVE",
    equipmentId: null,
    equipmentName: null,
    projectId: "prj-001",
    source: "DIRECT",
    versions: versions.filter(
      (v) => v.documentId === "doc-5",
    ),
    updatedAt: "2026-01-10T09:00:00Z",
    uploadedBy: "Safety Office",
  },
  {
    id: "doc-6",
    title:
      "Vibration Sensor Callout & Telemetry Setup Guide",
    docType: "Manual",
    activeVersionId: null,
    activeVersion: "v1.0",
    status: "FAILED",
    equipmentId: "eq-001",
    equipmentName: "Centrifugal Pump P-101",
    projectId: null,
    source: "DIRECT",
    versions: versions.filter(
      (v) => v.documentId === "doc-6",
    ),
    updatedAt: "2026-05-14T09:00:00Z",
    uploadedBy: "David Kim",
  },
  {
    id: "pdoc-1",
    title:
      "Project Execution Plan & Scope of Work - Cooling Water Upgrade",
    docType: "Specification",
    activeVersionId: "ver-pdoc-1-v20",
    activeVersion: "v2.0",
    status: "ACTIVE",
    equipmentId: null,
    equipmentName: null,
    projectId: "prj-001",
    source: "DIRECT",
    versions: versions.filter(
      (v) => v.documentId === "pdoc-1",
    ),
    updatedAt: "2026-05-01T09:00:00Z",
    uploadedBy: "Alex Morgan",
  },
];

const processingQueue: ProcessingQueueItem[] = [
  {
    id: "job-1",
    documentId: "doc-3",
    documentTitle:
      "Mechanical Seal Installation & Maintenance Guide",
    filename: "MSIG-P101-V11.pdf",
    status: "INDEXING",
    equipmentName: "Centrifugal Pump P-101",
    startedAt: "2026-05-14T09:05:00Z",
  },
  {
    id: "job-2",
    documentId: "doc-2",
    documentTitle:
      "P&ID Diagram P-101-002 (Utility Cooling Water)",
    filename: "PID-P101-002-REV2.pdf",
    status: "NEEDS_REVIEW",
    equipmentName: "Centrifugal Pump P-101",
    startedAt: "2026-05-12T09:05:00Z",
  },
  {
    id: "job-3",
    documentId: "doc-6",
    documentTitle:
      "Vibration Sensor Callout & Telemetry Setup Guide",
    filename: "VS-TELEMETRY-SETUP.pdf",
    status: "FAILED",
    equipmentName: "Centrifugal Pump P-101",
    startedAt: "2026-05-14T09:10:00Z",
    errorMessage:
      "Extraction failed on scanned pages 4-6. The previous active revision remains in use.",
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
/* Document queries                                                     */
/* ------------------------------------------------------------------ */

export async function mockGetDocuments(): Promise<
  Document[]
> {
  await delay(300);
  return [...documents];
}

export async function mockGetDocument(
  id: string,
): Promise<Document | null> {
  await delay(200);
  return (
    documents.find(
      (document) => document.id === id,
    ) ?? null
  );
}

export async function mockGetDocumentVersions(
  documentId: string,
): Promise<DocumentVersion[]> {
  await delay(200);
  return versions.filter(
    (version) =>
      version.documentId === documentId,
  );
}

export async function mockGetEquipmentDocuments(
  equipmentId: string,
): Promise<Document[]> {
  await delay(250);
  return documents.filter(
    (document) =>
      document.equipmentId === equipmentId,
  );
}

export async function mockGetProjectDocuments(
  projectId: string,
): Promise<Document[]> {
  await delay(250);
  const direct = documents.filter(
    (document) =>
      document.projectId === projectId,
  );
  // Inherited equipment documents linked through the project.
  const inherited = documents.filter(
    (document) =>
      document.projectId === null &&
      document.equipmentId !== null,
  );
  return [
    ...direct,
    ...inherited.map((document) => ({
      ...document,
      source: "INHERITED" as const,
    })),
  ];
}

export async function mockGetProcessingQueue(): Promise<
  ProcessingQueueItem[]
> {
  await delay(200);
  return [...processingQueue];
}

export async function mockAddDocumentVersion(
  documentId: string,
  filename: string,
): Promise<DocumentVersion> {
  await delay(500);
  const document = documents.find(
    (item) => item.id === documentId,
  );
  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }
  const version: DocumentVersion = {
    id: `ver-${documentId}-v${Date.now()}`,
    documentId,
    version: "v-new",
    filename,
    fileSize: "0.0 MB",
    status: "UPLOADING",
    uploadedBy: "Alex Morgan",
    uploadedAt: new Date().toISOString(),
    changeSummary: "New version uploaded for review.",
    coveragePct: null,
  };
  versions.push(version);
  documents = documents.map((item) =>
    item.id === documentId
      ? {
          ...item,
          status: "UPLOADING",
          versions: [
            ...item.versions,
            version,
          ],
          updatedAt: version.uploadedAt,
        }
      : item,
  );
  return version;
}
