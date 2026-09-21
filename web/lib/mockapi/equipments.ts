import type {
  CreateEquipmentInput,
  Equipment,
  EquipmentAccessRequest,
  EquipmentMember,
} from "@/lib/types/equipment";

let equipments: Equipment[] = [
  {
    id: "eq-001",
    name: "Centrifugal Pump P-101",
    type: "Pump",
    description:
      "Industrial centrifugal pump used for process fluid transfer.",
    status: "ACTIVE",
    owner: "Alex Morgan",
    ownerEmail: "alex@patch.local",
    documentsCount: 12,
    projectsCount: 3,
    location: "Plant A · Bay 2",
    serialNumber: "P101-2024-001",
    manufacturer: "FlowTech",
    model: "CP-400",
    createdAt: "2026-08-10T09:00:00Z",
    updatedAt: "2026-09-18T10:30:00Z",
  },
  {
    id: "eq-002",
    name: "Boiler B-201",
    type: "Boiler",
    description:
      "High-pressure process boiler serving the main production line.",
    status: "WARNING",
    owner: "Alex Morgan",
    ownerEmail: "alex@patch.local",
    documentsCount: 18,
    projectsCount: 2,
    location: "Plant A · Utility Room",
    serialNumber: "B201-2023-018",
    manufacturer: "ThermoWorks",
    model: "TB-800",
    createdAt: "2026-07-21T11:00:00Z",
    updatedAt: "2026-09-19T08:15:00Z",
  },
  {
    id: "eq-003",
    name: "Filler O2",
    type: "Filling Machine",
    description:
      "Automated filling equipment used on production line 2.",
    status: "ACTIVE",
    owner: "Sarah Wilson",
    ownerEmail: "sarah@patch.local",
    documentsCount: 9,
    projectsCount: 1,
    location: "Plant A · Line 2",
    serialNumber: "FO2-2025-004",
    manufacturer: "PackLine",
    model: "F200",
    createdAt: "2026-06-12T08:30:00Z",
    updatedAt: "2026-09-17T14:10:00Z",
  },
  {
    id: "eq-004",
    name: "Conveyor 11",
    type: "Conveyor",
    description:
      "Material conveyor connecting packaging and palletizing.",
    status: "ACTIVE",
    owner: "Alex Morgan",
    ownerEmail: "alex@patch.local",
    documentsCount: 7,
    projectsCount: 2,
    location: "Plant B · Line 1",
    serialNumber: "CV11-2024-011",
    manufacturer: "MoveTech",
    model: "MT-11",
    createdAt: "2026-05-18T10:20:00Z",
    updatedAt: "2026-09-16T12:00:00Z",
  },
  {
    id: "eq-005",
    name: "Capper 04",
    type: "Capping Machine",
    description:
      "Automated rotary capper for finished product packaging.",
    status: "WARNING",
    owner: "John Carter",
    ownerEmail: "john@patch.local",
    documentsCount: 14,
    projectsCount: 4,
    location: "Plant B · Packaging",
    serialNumber: "CAP04-2024-004",
    manufacturer: "PackLine",
    model: "RC-400",
    createdAt: "2026-04-20T09:00:00Z",
    updatedAt: "2026-09-15T16:40:00Z",
  },
  {
    id: "eq-1",
    name: "Boiler B-201",
    type: "Boiler",
    description:
      "High-pressure process boiler serving the main production line of the Boiler Upgrade Project.",
    status: "ACTIVE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 2,
    projectsCount: 1,
    location: "Boiler House",
    serialNumber: "B201-2023-018",
    manufacturer: "ThermoWorks",
    model: "TB-800",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-14T10:21:00Z",
  },
  {
    id: "eq-2",
    name: "Boiler Feed Pump P-101",
    type: "Pump",
    description:
      "Feedwater pump supplying Boiler B-201. Monitored for suction pressure stability.",
    status: "ACTIVE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 1,
    projectsCount: 1,
    location: "Utility Room",
    serialNumber: "P101-2024-001",
    manufacturer: "FlowTech",
    model: "CP-400",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-14T10:21:00Z",
  },
  {
    id: "eq-3",
    name: "Economizer E-101",
    type: "Heat Exchanger",
    description:
      "Flue-gas economizer recovering waste heat for feedwater preheating.",
    status: "ACTIVE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 0,
    projectsCount: 1,
    location: "Boiler House",
    serialNumber: "E101-2023-007",
    manufacturer: "ThermoWorks",
    model: "ECO-500",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-12T08:00:00Z",
  },
  {
    id: "eq-4",
    name: "Feedwater Tank T-101",
    type: "Tank",
    description:
      "Feedwater storage tank buffering supply to Boiler B-201.",
    status: "ACTIVE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 0,
    projectsCount: 1,
    location: "Utility Room",
    serialNumber: "T101-2023-003",
    manufacturer: "SteelFab",
    model: "FW-2000",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-12T08:00:00Z",
  },
  {
    id: "eq-5",
    name: "Burner BNR-201",
    type: "Burner",
    description:
      "Main burner assembly for Boiler B-201, upgraded under the Boiler Upgrade Project.",
    status: "WARNING",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 0,
    projectsCount: 1,
    location: "Boiler House",
    serialNumber: "BNR201-2025-001",
    manufacturer: "FlameTech",
    model: "B201-U",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-13T14:00:00Z",
  },
  {
    id: "eq-6",
    name: "Control Panel CP-201",
    type: "Control Panel",
    description:
      "Boiler control panel hosting the startup sequence and alarm management.",
    status: "ACTIVE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 0,
    projectsCount: 1,
    location: "Control Room",
    serialNumber: "CP201-2025-002",
    manufacturer: "ControlSys",
    model: "CP-201",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-12T08:00:00Z",
  },
  {
    id: "eq-7",
    name: "Steam Drum SD-201",
    type: "Pressure Vessel",
    description:
      "Steam drum separating saturated steam from boiler water.",
    status: "ACTIVE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 0,
    projectsCount: 1,
    location: "Boiler House",
    serialNumber: "SD201-2023-005",
    manufacturer: "SteelFab",
    model: "SD-900",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-12T08:00:00Z",
  },
  {
    id: "eq-8",
    name: "Condensate Pump P-201",
    type: "Pump",
    description:
      "Condensate return pump serving the boiler feedwater loop.",
    status: "MAINTENANCE",
    owner: "Engineering Team",
    ownerEmail: "engineering@patch.local",
    documentsCount: 0,
    projectsCount: 1,
    location: "Utility Room",
    serialNumber: "P201-2024-009",
    manufacturer: "FlowTech",
    model: "CP-250",
    createdAt: "2026-05-10T09:15:00Z",
    updatedAt: "2026-09-13T09:00:00Z",
  },
];

const members: Record<
  string,
  EquipmentMember[]
> = {
  "eq-001": [
    {
      id: "user-001",
      name: "Alex Morgan",
      email: "alex@patch.local",
      role: "OWNER",
      status: "ACTIVE",
    },
    {
      id: "user-002",
      name: "Sarah Wilson",
      email: "sarah@patch.local",
      role: "MEMBER",
      status: "ACTIVE",
    },
    {
      id: "user-003",
      name: "John Carter",
      email: "john@patch.local",
      role: "VIEWER",
      status: "ACTIVE",
    },
  ],
};

const accessRequests: Record<
  string,
  EquipmentAccessRequest[]
> = {
  "eq-001": [
    {
      id: "request-001",
      name: "Daniel Smith",
      email: "daniel@patch.local",
      requestedAt: "2026-09-20T10:15:00Z",
    },
  ],
};

export async function mockGetEquipments() {
  await delay(250);

  return [...equipments];
}

export async function mockGetEquipment(
  id: string,
) {
  await delay(200);

  return (
    equipments.find(
      (equipment) => equipment.id === id,
    ) ?? null
  );
}

export async function mockCreateEquipment(
  input: CreateEquipmentInput,
) {
  await delay(400);

  const now = new Date().toISOString();

  const equipment: Equipment = {
    id: `eq-${Date.now()}`,
    name: input.name,
    type: input.type,
    description: input.description,
    status: "ACTIVE",
    owner: "Alex Morgan",
    ownerEmail: "alex@patch.local",
    documentsCount: 0,
    projectsCount: 0,
    location:
      input.location || "Not specified",
    serialNumber:
      input.serialNumber || "Not specified",
    manufacturer:
      input.manufacturer || "Not specified",
    model:
      input.model || "Not specified",
    createdAt: now,
    updatedAt: now,
  };

  equipments = [
    equipment,
    ...equipments,
  ];

  return equipment;
}

export async function mockGetEquipmentMembers(
  equipmentId: string,
) {
  await delay(200);

  return members[equipmentId] ?? [];
}

export async function mockGetAccessRequests(
  equipmentId: string,
) {
  await delay(200);

  return (
    accessRequests[equipmentId] ?? []
  );
}

export async function mockApproveAccessRequest(
  equipmentId: string,
  requestId: string,
) {
  await delay(200);

  const requests =
    accessRequests[equipmentId] ?? [];

  const request = requests.find(
    (item) => item.id === requestId,
  );

  if (!request) {
    return null;
  }

  accessRequests[equipmentId] =
    requests.filter(
      (item) => item.id !== requestId,
    );

  const newMember: EquipmentMember = {
    id: `user-${Date.now()}`,
    name: request.name,
    email: request.email,
    role: "MEMBER",
    status: "ACTIVE",
  };

  members[equipmentId] = [
    ...(members[equipmentId] ?? []),
    newMember,
  ];

  return newMember;
}

export async function mockRejectAccessRequest(
  equipmentId: string,
  requestId: string,
) {
  await delay(200);

  accessRequests[equipmentId] = (
    accessRequests[equipmentId] ?? []
  ).filter(
    (item) => item.id !== requestId,
  );

  return true;
}

export type EquipmentActivityEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
};

const equipmentActivity: Record<
  string,
  EquipmentActivityEvent[]
> = {
  "eq-1": [
    {
      id: "eqact-1-1",
      actor: "Mark Stevens",
      action: "uploaded a new document version",
      target: "Boiler Operations Manual",
      createdAt: "2026-09-14T08:00:00Z",
    },
    {
      id: "eqact-1-2",
      actor: "Sarah Wilson",
      action: "approved document revision",
      target: "Boiler Operations Manual Rev. 4.2",
      createdAt: "2026-09-13T14:10:00Z",
    },
    {
      id: "eqact-1-3",
      actor: "James Miller",
      action: "created maintenance log",
      target: "Boiler feedwater pressure drop",
      createdAt: "2026-09-12T09:45:00Z",
    },
  ],
  "eq-001": [
    {
      id: "eqact-001-1",
      actor: "Alex Morgan",
      action: "updated equipment details",
      target: "Centrifugal Pump P-101",
      createdAt: "2026-09-18T10:30:00Z",
    },
    {
      id: "eqact-001-2",
      actor: "Sarah Wilson",
      action: "reviewed document",
      target: "P-101 Operation & Maintenance Manual",
      createdAt: "2026-09-17T14:10:00Z",
    },
  ],
};

export async function mockGetEquipmentActivity(
  equipmentId: string,
): Promise<EquipmentActivityEvent[]> {
  await delay(200);

  return equipmentActivity[equipmentId] ?? [];
}

function delay(
  milliseconds: number,
) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}