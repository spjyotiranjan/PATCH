import type {
  CreateMaintenanceLogInput,
  MaintenanceLog,
  UpdateMaintenanceLogInput,
} from "@/lib/types/maintenance";

/* ------------------------------------------------------------------ */
/* Stable mock data                                                     */
/* ------------------------------------------------------------------ */

let logs: MaintenanceLog[] = [
  {
    id: "log-1",
    projectId: "prj-001",
    title: "Boiler feedwater pressure drop",
    description:
      "Feedwater pressure dropped below the expected operating range during routine operation.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    scope: "EQUIPMENT",
    equipmentId: "eq-001",
    equipmentName: "Boiler Feed Pump P-101",
    reportedBy: "James Miller",
    reportedByEmail: "james@patch.local",
    assignedTo: "Sarah Wilson",
    assignedToEmail: "sarah@patch.local",
    createdAt: "2026-05-14T09:00:00Z",
    updatedAt: "2026-05-14T10:00:00Z",
    completedAt: null,
    attachments: [],
    comments: [],
  },
  {
    id: "log-2",
    projectId: "prj-001",
    title: "Burner inspection completed",
    description:
      "Routine burner inspection completed. No abnormal wear was identified.",
    status: "COMPLETED",
    priority: "MEDIUM",
    scope: "EQUIPMENT",
    equipmentId: "eq-005",
    equipmentName: "Burner BNR-201",
    reportedBy: "Robert Brown",
    reportedByEmail: "robert@patch.local",
    assignedTo: null,
    assignedToEmail: null,
    createdAt: "2026-05-13T09:00:00Z",
    updatedAt: "2026-05-13T12:00:00Z",
    completedAt: "2026-05-13T12:00:00Z",
    attachments: [],
    comments: [],
  },
  {
    id: "log-3",
    projectId: "prj-001",
    title: "Control panel alarm review",
    description:
      "Repeated warning alarm observed during startup sequence.",
    status: "OPEN",
    priority: "MEDIUM",
    scope: "EQUIPMENT",
    equipmentId: "eq-006",
    equipmentName: "Control Panel CP-201",
    reportedBy: "Sarah Johnson",
    reportedByEmail: "sarah.j@patch.local",
    assignedTo: "James Miller",
    assignedToEmail: "james@patch.local",
    createdAt: "2026-05-12T09:00:00Z",
    updatedAt: "2026-05-12T09:30:00Z",
    completedAt: null,
    attachments: [],
    comments: [],
  },
  {
    id: "log-4",
    projectId: "prj-001",
    title: "Economizer temperature check",
    description:
      "Temperature readings checked against the approved operating range.",
    status: "COMPLETED",
    priority: "LOW",
    scope: "EQUIPMENT",
    equipmentId: "eq-003",
    equipmentName: "Economizer E-101",
    reportedBy: "James Miller",
    reportedByEmail: "james@patch.local",
    assignedTo: null,
    assignedToEmail: null,
    createdAt: "2026-05-11T09:00:00Z",
    updatedAt: "2026-05-11T11:00:00Z",
    completedAt: "2026-05-11T11:00:00Z",
    attachments: [],
    comments: [],
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
/* Maintenance log operations                                           */
/* ------------------------------------------------------------------ */

export async function mockGetMaintenanceLogs(
  projectId: string,
): Promise<MaintenanceLog[]> {
  await delay(300);
  return logs.filter(
    (log) => log.projectId === projectId,
  );
}

export async function mockGetMaintenanceLog(
  logId: string,
): Promise<MaintenanceLog | null> {
  await delay(200);
  return (
    logs.find((log) => log.id === logId) ??
    null
  );
}

export async function mockGetEquipmentMaintenanceLogs(
  equipmentId: string,
): Promise<MaintenanceLog[]> {
  await delay(250);
  return logs.filter(
    (log) => log.equipmentId === equipmentId,
  );
}

export async function mockCreateMaintenanceLog(
  input: CreateMaintenanceLogInput,
): Promise<MaintenanceLog> {
  await delay(500);
  const now = new Date().toISOString();
  const log: MaintenanceLog = {
    id: `log-${Date.now()}`,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    status: "OPEN",
    priority: input.priority,
    scope: input.scope,
    equipmentId: input.equipmentId ?? null,
    equipmentName: null,
    reportedBy: "Alex Morgan",
    reportedByEmail: "alex@patch.local",
    assignedTo: input.assignedTo ?? null,
    assignedToEmail: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    attachments: [],
    comments: [],
  };
  logs = [log, ...logs];
  return log;
}

export async function mockUpdateMaintenanceLog(
  logId: string,
  input: UpdateMaintenanceLogInput,
): Promise<MaintenanceLog | null> {
  await delay(400);
  const existing = logs.find(
    (log) => log.id === logId,
  );
  if (!existing) {
    return null;
  }
  const updated: MaintenanceLog = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
    completedAt:
      input.status === "COMPLETED"
        ? new Date().toISOString()
        : existing.completedAt,
  };
  logs = logs.map((log) =>
    log.id === logId ? updated : log,
  );
  return updated;
}
