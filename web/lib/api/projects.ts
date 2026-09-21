import type {
  AccessRequest,
  CreateProjectInput,
  Project,
  ProjectActivity,
  ProjectMember,
  RequestProjectAccessInput,
} from "@/lib/types/project";

import {
  mockCreateProject,
  mockDecideProjectAccess,
  mockGetEquipmentProjectIds,
  mockGetOwnerInbox,
  mockGetProject,
  mockGetProjectAccessRequests,
  mockGetProjectActivity,
  mockGetProjectEquipmentIds,
  mockGetProjectMembers,
  mockGetProjects,
  mockRequestProjectAccess,
  type ProjectAccessDecision,
} from "@/lib/mockapi/projects";

/**
 * Project service boundary.
 *
 * UI code consumes these functions. A future real backend replaces
 * the mock implementation inside this module without touching pages
 * or components.
 */

export async function getProjects(): Promise<
  Project[]
> {
  return mockGetProjects();
}

export async function getProject(
  id: string,
): Promise<Project | null> {
  return mockGetProject(id);
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  return mockCreateProject(input);
}

export async function getProjectMembers(
  projectId: string,
): Promise<ProjectMember[]> {
  return mockGetProjectMembers(projectId);
}

export async function getProjectActivity(
  projectId: string,
): Promise<ProjectActivity[]> {
  return mockGetProjectActivity(projectId);
}

export async function getProjectEquipmentIds(
  projectId: string,
): Promise<string[]> {
  return mockGetProjectEquipmentIds(
    projectId,
  );
}

export async function getEquipmentProjectIds(
  equipmentId: string,
): Promise<string[]> {
  return mockGetEquipmentProjectIds(
    equipmentId,
  );
}

export async function requestProjectAccess(
  input: RequestProjectAccessInput,
): Promise<void> {
  return mockRequestProjectAccess(input);
}

export async function getOwnerInbox(): Promise<
  (AccessRequest & {
    projectName: string;
  })[]
> {
  return mockGetOwnerInbox();
}

export async function getProjectAccessRequests(
  projectId: string,
): Promise<AccessRequest[]> {
  return mockGetProjectAccessRequests(
    projectId,
  );
}

export async function decideProjectAccess(
  requestId: string,
  decision: ProjectAccessDecision,
): Promise<void> {
  return mockDecideProjectAccess(
    requestId,
    decision,
  );
}
