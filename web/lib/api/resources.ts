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
export const getEquipmentRecord = async (key: string) =>
  (await api<{ equipment: EquipmentRecord }>(`/api/equipments/${id(key)}`))
    .equipment;
export const getProjectRecord = async (key: string) =>
  (await api<{ project: ProjectRecord }>(`/api/projects/${id(key)}`)).project;
export const discover = (kind: EntityKind) =>
  items<Discovery>(`/api/${kind}/discover`);
export const createEquipmentRecord = async (body: {
  name: string;
  type: string;
  location: string;
  model?: string | null;
  description?: string | null;
  documentsMode: "ADD_NOW" | "SKIP_FOR_NOW";
}) =>
  (await post<{ equipment: EquipmentRecord }>("/api/equipments", body))
    .equipment;
export const createProjectRecord = async (body: {
  name: string;
  description: string;
  status: ProjectRecord["status"];
  includedEquipmentIds: string[];
  documentsMode: "ADD_NOW" | "SKIP_FOR_NOW";
}) => (await post<{ project: ProjectRecord }>("/api/projects", body)).project;
export const updateEntity = async (
  kind: EntityKind,
  key: string,
  body: unknown,
) => {
  const path = `/api/${kind}/${id(key)}`;
  return kind === "equipments"
    ? (await patch<{ equipment: EquipmentRecord }>(path, body)).equipment
    : (await patch<{ project: ProjectRecord }>(path, body)).project;
};
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
