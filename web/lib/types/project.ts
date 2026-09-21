export type ProjectStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED" | "ON_HOLD";

export type MemberRole = "OWNER" | "MEMBER" | "VIEWER";

export type MembershipStatus =
  | "MEMBER"
  | "NOT_A_MEMBER"
  | "PENDING"
  | "RESTRICTED";

export type Project = {
  id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  owner: string;
  ownerEmail: string;
  equipmentCount: number;
  memberCount: number;
  documentsCount: number;
  membership: MembershipStatus;
  profileStatus: "FRESH" | "REFRESHING" | "STALE";
  lastProfileUpdate: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
};

export type ProjectActivity = {
  id: string;
  type:
    | "MEMBER_JOINED"
    | "DOCUMENT_ADDED"
    | "LOG_CREATED"
    | "PROCEDURE_PUBLISHED"
    | "STATUS_CHANGED"
    | "EQUIPMENT_LINKED";
  actor: string;
  actorEmail: string;
  description: string;
  createdAt: string;
};

export type AccessRequest = {
  id: string;
  projectId: string;
  name: string;
  email: string;
  organization: string;
  message: string;
  requestedAt: string;
};

export type CreateProjectInput = {
  name: string;
  code: string;
  description: string;
  equipmentIds?: string[];
  stagedDocumentsCount?: number;
};

export type RequestProjectAccessInput = {
  projectId: string;
  name: string;
  email: string;
  organization: string;
  message: string;
};
