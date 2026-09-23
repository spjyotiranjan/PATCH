export type LogStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type LogPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type LogScope = "OVERALL_PROJECT" | "EQUIPMENT";

export type MaintenanceLog = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: LogStatus;
  priority: LogPriority;
  scope: LogScope;
  equipmentId: string | null;
  equipmentName: string | null;
  reportedBy: string;
  reportedByEmail: string;
  assignedTo: string | null;
  assignedToEmail: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  attachments: LogAttachment[];
  comments: LogComment[];
};

export type LogAttachment = {
  id: string;
  logId: string;
  filename: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type LogComment = {
  id: string;
  logId: string;
  author: string;
  authorEmail: string;
  content: string;
  createdAt: string;
};

export type CreateMaintenanceLogInput = {
  projectId: string;
  title: string;
  description: string;
  priority: LogPriority;
  scope: LogScope;
  equipmentId?: string;
  assignedTo?: string;
};

export type UpdateMaintenanceLogInput = {
  title?: string;
  description?: string;
  status?: LogStatus;
  priority?: LogPriority;
  assignedTo?: string;
};
