import { api, items, post, patch, remove, id } from "./http";
import type {
  AccessRequest,
  Discovery,
  EquipmentRecord,
  ProjectRecord,
  Profile,
  Entity,
} from "./contracts";

export type EntityKind = "equipments" | "projects";
export const getEquipmentRecords = () =>
  items<EquipmentRecord>("/api/equipments");
export const getProjectRecords = () => items<ProjectRecord>("/api/projects");
export const getEquipmentRecord = (key: string) =>
  api<EquipmentRecord>(`/api/equipments/${id(key)}`);
export const getProjectRecord = (key: string) =>
  api<ProjectRecord>(`/api/projects/${id(key)}`);
export const discover = (kind: EntityKind) =>
  items<Discovery>(`/api/${kind}/discover`);
export const createEquipmentRecord = (body: {
  name: string;
  type: string;
  location: string;
  model?: string | null;
  description?: string | null;
  documentsMode: "ADD_NOW" | "SKIP_FOR_NOW";
}) => post<EquipmentRecord>("/api/equipments", body);
export const createProjectRecord = (body: {
  name: string;
  description: string;
  status: ProjectRecord["status"];
  includedEquipmentIds: string[];
  documentsMode: "ADD_NOW" | "SKIP_FOR_NOW";
}) => post<ProjectRecord>("/api/projects", body);
export const updateEntity = (kind: EntityKind, key: string, body: unknown) =>
  patch<EquipmentRecord | ProjectRecord>(`/api/${kind}/${id(key)}`, body);
export const deleteEntity = (kind: EntityKind, key: string) =>
  remove(`/api/${kind}/${id(key)}`);
const accessPath = (kind: EntityKind, key: string) =>
  `/api/${kind}/${id(key)}/${kind === "projects" ? "membership-requests" : "access-requests"}`;
export const getAccessRequests = (kind: EntityKind, key: string) =>
  items<AccessRequest>(accessPath(kind, key));
export const requestAccess = (kind: EntityKind, key: string) =>
  post(accessPath(kind, key));
export const decideAccess = (
  kind: EntityKind,
  key: string,
  requestId: string,
  decision: "APPROVE" | "REJECT",
) => post(`${accessPath(kind, key)}/${id(requestId)}/decision`, { decision });
export const revokeAccess = (kind: EntityKind, key: string, userId: string) =>
  remove(
    `/api/${kind}/${id(key)}/${kind === "projects" ? "memberships" : "manage-access"}/${id(userId)}`,
  );
export const getProfile = (entity: Entity) =>
  api<Profile>(
    `/api/${entity.type === "PROJECT" ? "projects" : "equipments"}/${id(entity.id)}/retrieval-profile`,
  );
