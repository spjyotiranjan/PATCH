export type EquipmentStatus =
  | "ACTIVE"
  | "WARNING"
  | "INACTIVE"
  | "MAINTENANCE";

export type Equipment = {
  id: string;
  name: string;
  type: string;
  description: string;
  status: EquipmentStatus;
  owner: string;
  ownerEmail: string;
  documentsCount: number;
  projectsCount: number;
  location: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentMemberRole =
  | "OWNER"
  | "MEMBER"
  | "VIEWER";

export type EquipmentMember = {
  id: string;
  name: string;
  email: string;
  role: EquipmentMemberRole;
  status: "ACTIVE" | "PENDING";
};

export type EquipmentAccessRequest = {
  id: string;
  name: string;
  email: string;
  requestedAt: string;
};

export type CreateEquipmentInput = {
  name: string;
  type: string;
  description: string;
  location?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
};