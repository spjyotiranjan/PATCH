import type {
  AccessRequest,
  CreateProjectInput,
  Project,
  ProjectActivity,
  ProjectMember,
  RequestProjectAccessInput,
} from "@/lib/types/project";

/* ------------------------------------------------------------------ */
/* Stable mock data                                                     */
/* ------------------------------------------------------------------ */

let projects: Project[] = [
  {
    id: "prj-001",
    name: "Boiler Upgrade Project",
    code: "PRJ-2025-089",
    description:
      "Upgrade the existing boiler system to improve thermal efficiency, ensure compliance with current standards, and increase overall reliability. The project includes new burner installation, control system upgrade, and safety enhancements.",
    status: "ACTIVE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    equipmentCount: 8,
    memberCount: 7,
    documentsCount: 14,
    membership: "MEMBER",
    profileStatus: "FRESH",
    lastProfileUpdate: "2026-09-14T09:58:00Z",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-14T10:21:00Z",
  },
  {
    id: "prj-002",
    name: "Cooling Tower Optimization",
    code: "PRJ-2025-061",
    description:
      "Improve cooling tower performance and reduce water consumption through systematic analysis of current operating parameters and implementation of optimized control strategies.",
    status: "ACTIVE",
    owner: "Facilities Team",
    ownerEmail: "facilities@patch.local",
    equipmentCount: 5,
    memberCount: 4,
    documentsCount: 9,
    membership: "MEMBER",
    profileStatus: "STALE",
    lastProfileUpdate: "2026-08-20T11:00:00Z",
    createdAt: "2026-04-18T10:00:00Z",
    updatedAt: "2026-09-10T14:30:00Z",
  },
  {
    id: "prj-003",
    name: "Plant Expansion Project",
    code: "PRJ-2025-102",
    description:
      "Expand production capacity with new line installation and infrastructure upgrades to meet increased demand forecasts for Q1 2026.",
    status: "ACTIVE",
    owner: "Capital Projects",
    ownerEmail: "capex@patch.local",
    equipmentCount: 12,
    memberCount: 11,
    documentsCount: 22,
    membership: "NOT_A_MEMBER",
    profileStatus: "FRESH",
    lastProfileUpdate: "2026-09-18T08:00:00Z",
    createdAt: "2026-06-01T08:30:00Z",
    updatedAt: "2026-09-19T09:00:00Z",
  },
  {
    id: "prj-004",
    name: "Compressor Reliability Improvement",
    code: "PRJ-2025-074",
    description:
      "Enhance compressor reliability and reduce unplanned downtime through predictive maintenance implementation and component upgrades.",
    status: "COMPLETED",
    owner: "Maintenance Team",
    ownerEmail: "maintenance@patch.local",
    equipmentCount: 6,
    memberCount: 5,
    documentsCount: 17,
    membership: "MEMBER",
    profileStatus: "STALE",
    lastProfileUpdate: "2026-07-15T12:00:00Z",
    createdAt: "2026-02-10T09:00:00Z",
    updatedAt: "2026-08-01T16:00:00Z",
  },
];

const members: Record<string, ProjectMember[]> = {
  "prj-001": [
    {
      id: "user-001",
      name: "Alex Morgan",
      email: "alex@patch.local",
      role: "OWNER",
      joinedAt: "2026-05-10T09:15:00Z",
    },
    {
      id: "user-002",
      name: "Sarah Wilson",
      email: "sarah@patch.local",
      role: "MEMBER",
      joinedAt: "2026-05-12T10:00:00Z",
    },
    {
      id: "user-003",
      name: "John Carter",
      email: "john@patch.local",
      role: "MEMBER",
      joinedAt: "2026-05-15T11:30:00Z",
    },
    {
      id: "user-004",
      name: "Elena Rostova",
      email: "elena@patch.local",
      role: "VIEWER",
      joinedAt: "2026-06-01T09:00:00Z",
    },
    {
      id: "user-005",
      name: "David Kim",
      email: "david@patch.local",
      role: "MEMBER",
      joinedAt: "2026-06-05T08:30:00Z",
    },
    {
      id: "user-006",
      name: "Mark Stevens",
      email: "mark@patch.local",
      role: "MEMBER",
      joinedAt: "2026-06-10T10:00:00Z",
    },
    {
      id: "user-007",
      name: "Lisa Park",
      email: "lisa@patch.local",
      role: "VIEWER",
      joinedAt: "2026-07-01T09:00:00Z",
    },
  ],
};

const activity: Record<string, ProjectActivity[]> = {
  "prj-001": [
    {
      id: "act-001",
      type: "DOCUMENT_ADDED",
      actor: "Alex Morgan",
      actorEmail: "alex@patch.local",
      description: "Added Commissioning & Safety Risk Assessment (v0.9)",
      createdAt: "2026-09-14T10:21:00Z",
    },
    {
      id: "act-002",
      type: "PROCEDURE_PUBLISHED",
      actor: "Sarah Wilson",
      actorEmail: "sarah@patch.local",
      description: "Published Boiler feed pump vibration check (Version 2)",
      createdAt: "2026-09-13T14:10:00Z",
    },
    {
      id: "act-003",
      type: "LOG_CREATED",
      actor: "John Carter",
      actorEmail: "john@patch.local",
      description: "Created maintenance log: Feedwater pump seal inspection",
      createdAt: "2026-09-12T09:45:00Z",
    },
    {
      id: "act-004",
      type: "MEMBER_JOINED",
      actor: "Lisa Park",
      actorEmail: "lisa@patch.local",
      description: "Lisa Park joined the project as Viewer",
      createdAt: "2026-09-10T11:00:00Z",
    },
    {
      id: "act-005",
      type: "EQUIPMENT_LINKED",
      actor: "Alex Morgan",
      actorEmail: "alex@patch.local",
      description: "Linked Control Panel CP-201 to the project",
      createdAt: "2026-09-08T15:30:00Z",
    },
    {
      id: "act-006",
      type: "STATUS_CHANGED",
      actor: "Alex Morgan",
      actorEmail: "alex@patch.local",
      description: "Changed project status from Planning to Active",
      createdAt: "2026-08-01T09:00:00Z",
    },
  ],
};

const accessRequests: Record<string, AccessRequest[]> = {
  "prj-001": [
    {
      id: "req-001",
      projectId: "prj-001",
      name: "Daniel Smith",
      email: "daniel@patch.local",
      organization: "Operations",
      message:
        "I maintain the feedwater pumps and need access to the project sources.",
      requestedAt: "2026-09-20T10:15:00Z",
    },
    {
      id: "req-002",
      projectId: "prj-001",
      name: "Priya Nair",
      email: "priya@patch.local",
      organization: "Safety",
      message: "Reviewing burner isolation coverage for the upgrade.",
      requestedAt: "2026-09-21T08:40:00Z",
    },
  ],
};

/**
 * Project-to-Equipment inclusion graph. Equipment records are
 * referenced by ID; they are never copied into the project.
 */
const projectEquipmentLinks: Record<string, string[]> = {
  "prj-001": [
    "eq-1",
    "eq-2",
    "eq-3",
    "eq-4",
    "eq-5",
    "eq-6",
    "eq-7",
    "eq-8",
  ],
  "prj-002": ["eq-003", "eq-004"],
  "prj-003": ["eq-001", "eq-004", "eq-005"],
  "prj-004": ["eq-005"],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* Project CRUD                                                         */
/* ------------------------------------------------------------------ */

export async function mockGetProjects(): Promise<Project[]> {
  await delay(300);
  return [...projects];
}

export async function mockGetProject(
  id: string,
): Promise<Project | null> {
  await delay(200);
  return projects.find((p) => p.id === id) ?? null;
}

export async function mockCreateProject(
  input: CreateProjectInput,
): Promise<Project> {
  await delay(500);
  const now = new Date().toISOString();
  const project: Project = {
    id: `prj-${Date.now()}`,
    name: input.name,
    code: input.code,
    description: input.description,
    status: "ACTIVE",
    owner: "Alex Morgan",
    ownerEmail: "alex@patch.local",
    equipmentCount: input.equipmentIds?.length ?? 0,
    memberCount: 1,
    documentsCount: input.stagedDocumentsCount ?? 0,
    membership: "MEMBER",
    profileStatus: "STALE",
    lastProfileUpdate: now,
    createdAt: now,
    updatedAt: now,
  };
  projects = [project, ...projects];
  return project;
}

/* ------------------------------------------------------------------ */
/* Project sub-resources                                                */
/* ------------------------------------------------------------------ */

export async function mockGetProjectMembers(
  projectId: string,
): Promise<ProjectMember[]> {
  await delay(200);
  return members[projectId] ?? [];
}

export async function mockGetProjectActivity(
  projectId: string,
): Promise<ProjectActivity[]> {
  await delay(200);
  return activity[projectId] ?? [];
}

/* ------------------------------------------------------------------ */
/* Equipment inclusion graph                                            */
/* ------------------------------------------------------------------ */

export async function mockGetProjectEquipmentIds(
  projectId: string,
): Promise<string[]> {
  await delay(200);
  return projectEquipmentLinks[projectId] ?? [];
}

export async function mockGetEquipmentProjectIds(
  equipmentId: string,
): Promise<string[]> {
  await delay(200);
  return Object.entries(projectEquipmentLinks)
    .filter(([, equipmentIds]) =>
      equipmentIds.includes(equipmentId),
    )
    .map(([projectId]) => projectId);
}

/* ------------------------------------------------------------------ */
/* Access requests                                                      */
/* ------------------------------------------------------------------ */

export type ProjectAccessDecision = "APPROVE" | "REJECT";

export async function mockGetProjectAccessRequests(
  projectId: string,
): Promise<AccessRequest[]> {
  await delay(200);
  return accessRequests[projectId] ?? [];
}

export async function mockGetOwnerInbox(): Promise<
  (AccessRequest & { projectName: string })[]
> {
  await delay(250);
  const inbox: (AccessRequest & {
    projectName: string;
  })[] = [];

  for (const project of projects) {
    // Inbox scope: projects owned by the demo user's team.
    // A real backend derives this from the caller's membership.
    if (
      project.ownerEmail !==
        "engineering@patch.local" &&
      project.ownerEmail !==
        "alex@patch.local"
    ) {
      continue;
    }

    for (const request of accessRequests[project.id] ??
      []) {
      inbox.push({
        ...request,
        projectName: project.name,
      });
    }
  }

  return inbox;
}

export async function mockDecideProjectAccess(
  requestId: string,
  decision: ProjectAccessDecision,
): Promise<void> {
  await delay(400);

  for (const projectId of Object.keys(
    accessRequests,
  )) {
    const requests =
      accessRequests[projectId] ?? [];
    const request = requests.find(
      (item) => item.id === requestId,
    );

    if (!request) {
      continue;
    }

    accessRequests[projectId] =
      requests.filter(
        (item) => item.id !== requestId,
      );

    if (decision === "APPROVE") {
      const projectMembers =
        members[projectId] ?? [];
      members[projectId] = [
        ...projectMembers,
        {
          id: `user-${Date.now()}`,
          name: request.name,
          email: request.email,
          role: "MEMBER",
          joinedAt:
            new Date().toISOString(),
        },
      ];
      projects = projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              memberCount:
                project.memberCount + 1,
            }
          : project,
      );
    }

    return;
  }

  throw new Error("REQUEST_NOT_FOUND");
}

export async function mockRequestProjectAccess(
  input: RequestProjectAccessInput,
): Promise<void> {
  await delay(400);
  const requests = accessRequests[input.projectId] ?? [];
  accessRequests[input.projectId] = [
    ...requests,
    {
      id: `req-${Date.now()}`,
      projectId: input.projectId,
      name: input.name,
      email: input.email,
      organization: input.organization,
      message: input.message,
      requestedAt: new Date().toISOString(),
    },
  ];
  // Update project membership state to PENDING
  projects = projects.map((p) =>
    p.id === input.projectId
      ? { ...p, membership: "PENDING" as const }
      : p,
  );
}
