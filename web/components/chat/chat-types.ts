export type ReferenceType = "DOCUMENT" | "EQUIPMENT" | "PROJECT" | "ENTITY";

export interface AssignedReference {
  type: ReferenceType;
  id: string;
  name: string;
}

export interface Citation {
  id: string;
  documentId: string;
  chunkId?: string;
  documentVersionId: string;
  documentTitle: string;
  revision: string;
  page?: number | string;
  section?: string;
  excerpt: string;
  approvalState: "APPROVED" | "ACTIVE" | "INDEXED" | "NEEDS_REVIEW" | "SUPERSEDED" | "OUT_OF_DATE";
  includedIn?: {
    equipmentName?: string;
    projectName?: string;
  };
}

export interface EvidenceSourceCard {
  id: string;
  documentTitle: string;
  status: "Active" | "Approved" | "Indexed" | "Needs review" | "Conflicting" | "Outdated";
  revision: string;
  date?: string;
  page?: number | string;
  section?: string;
  excerpt?: string;
  includedIn?: {
    equipmentName?: string;
    projectName?: string;
  };
}

export interface SearchedScopeItem {
  type: "Equipment" | "Project";
  name: string;
}

export interface AnswerStep {
  id: string;
  text: string;
  citationIds?: string[];
}

export interface SafetyBoundary {
  title: string;
  text: string;
}

export interface ChatTurnData {
  id: string;
  clientTurnId: string;
  question: string;
  assignedReferences: AssignedReference[];
  timestamp: string;
  state: "PENDING" | "COMPLETED";
  status?: "approved" | "incomplete" | "conflicting" | "outdated" | "unavailable";
  routing?: {
    selectedEntities: Array<{ type: "EQUIPMENT" | "PROJECT"; name: string; reason?: string }>;
    usedStructuralFallback?: boolean;
    profileVersions?: number[];
  };
  answer?: {
    summary?: string | null;
    steps: AnswerStep[];
  };
  citations?: Citation[];
  evidenceSources?: EvidenceSourceCard[];
  searchedScope?: SearchedScopeItem[];
  safetyBoundary?: SafetyBoundary;
  followUps?: string[];
  warnings?: string[];
}

export interface ChatSessionData {
  id: string;
  title: string;
  updatedAt: string;
  timestampLabel: string;
  group: "Today" | "Yesterday" | "Earlier this week";
  turns: ChatTurnData[];
}

// Available references for @ tag completion
export const AVAILABLE_REFERENCES: AssignedReference[] = [
  { type: "EQUIPMENT", id: "eq-filler-02", name: "Filler 02" },
  { type: "EQUIPMENT", id: "eq-conveyor-11", name: "Conveyor 11" },
  { type: "EQUIPMENT", id: "eq-capper-04", name: "Capper 04" },
  { type: "EQUIPMENT", id: "eq-palletizer-02", name: "Palletizer 02" },
  { type: "DOCUMENT", id: "doc-p101-manual", name: "P-101 Maintenance Manual" },
  { type: "DOCUMENT", id: "doc-b201-pid", name: "B-201 P&ID" },
  { type: "DOCUMENT", id: "doc-loto-standard", name: "LOTO Safety Standard" },
  { type: "PROJECT", id: "proj-plant-expansion", name: "Plant Expansion Project" },
  { type: "PROJECT", id: "proj-boiler-upgrade", name: "Boiler Upgrade Project" },
];

export const DEFAULT_SESSIONS: ChatSessionData[] = [
  {
    id: "filler-02-pressure",
    title: "Filler 02 pressure instability",
    updatedAt: "10:42 AM",
    timestampLabel: "10:42 AM",
    group: "Today",
    turns: [
      {
        id: "turn-1",
        clientTurnId: "turn-uuid-1",
        question: "What are the likely causes of pressure instability and how can I troubleshoot it?",
        assignedReferences: [
          { type: "EQUIPMENT", id: "eq-filler-02", name: "Filler 02" },
          { type: "DOCUMENT", id: "doc-p101-manual", name: "P-101 Maintenance Manual" },
        ],
        timestamp: "10:42 AM",
        state: "COMPLETED",
        status: "approved",
        routing: {
          selectedEntities: [
            { type: "EQUIPMENT", name: "Filler 02", reason: "profile match" },
            { type: "PROJECT", name: "Plant Expansion Project", reason: "included equipment" },
          ],
          usedStructuralFallback: false,
          profileVersions: [2],
        },
        answer: {
          summary:
            "Based on the P-101 Maintenance Manual (Rev. 2) for Filler 02, pressure instability is typically caused by issues in the pressure control system, restricted flow, or air entrainment. Follow the troubleshooting steps below.",
          steps: [
            { id: "s1", text: "Verify stable air supply (80-100 psi) and check for leaks." },
            { id: "s2", text: "Inspect inlet filter and clean or replace if restricted." },
            { id: "s3", text: "Check pressure control valve for worn seat or debris; clean and inspect.", citationIds: ["cit-1"] },
            { id: "s4", text: "Bleed air from the system at the highest point." },
            { id: "s5", text: "Verify pressure transmitter reading; recalibrate if needed." },
            { id: "s6", text: "If instability persists, check pump bearings and alignment." },
          ],
        },
        citations: [
          {
            id: "cit-1",
            documentId: "doc-p101",
            documentVersionId: "ver-p101-rev2",
            documentTitle: "P-101 Maintenance Manual",
            revision: "Revision 2 (Active)",
            page: 42,
            section: "6.3, 6.4",
            excerpt: "Use ISO VG 68 mineral oil. Maintain oil level between MIN and MAX marks on the sight glass. Check oil level daily.",
            approvalState: "ACTIVE",
            includedIn: {
              equipmentName: "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
          {
            id: "cit-2",
            documentId: "doc-p101-old",
            documentVersionId: "ver-p101-rev1",
            documentTitle: "P-101 Maintenance Manual",
            revision: "Revision 1 (Superseded)",
            page: 41,
            section: "6.2",
            excerpt: "Use ISO VG 46 mineral oil. Maintain oil level between MIN and MAX marks on the sight glass.",
            approvalState: "APPROVED",
            includedIn: {
              equipmentName: "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
          {
            id: "cit-3",
            documentId: "doc-b201",
            documentVersionId: "ver-b201-rev3",
            documentTitle: "B-201 P&ID",
            revision: "Revision 3 (Indexed)",
            page: 5,
            section: "—",
            excerpt: "P&ID showing pressure control loop for Filler 02.",
            approvalState: "INDEXED",
            includedIn: {
              equipmentName: "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
        ],
        evidenceSources: [
          {
            id: "ev-1",
            documentTitle: "P-101 Maintenance Manual",
            status: "Active",
            revision: "Revision 2 (Active)",
            date: "May 14, 2025",
            page: 42,
            section: "6.3, 6.4",
            excerpt: "Use ISO VG 68 mineral oil. Maintain oil level between MIN and MAX marks on the sight glass. Check oil level daily.",
            includedIn: {
              equipmentName: "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
          {
            id: "ev-2",
            documentTitle: "P-101 Maintenance Manual",
            status: "Approved",
            revision: "Revision 1 (Superseded)",
            date: "May 14, 2025",
            page: 41,
            section: "6.2",
            excerpt: "Use ISO VG 46 mineral oil. Maintain oil level between MIN and MAX marks on the sight glass.",
            includedIn: {
              equipmentName: "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
          {
            id: "ev-3",
            documentTitle: "B-201 P&ID",
            status: "Indexed",
            revision: "Revision 3 (Indexed)",
            date: "May 10, 2025",
            page: 5,
            excerpt: "P&ID showing pressure control loop for Filler 02.",
            includedIn: {
              equipmentName: "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
          {
            id: "ev-4",
            documentTitle: "P-101 Maintenance Manual",
            status: "Needs review",
            revision: "Revision 1",
            date: "May 5, 2025",
            excerpt: "Document is pending review; some details may be incomplete or subject to change.",
          },
          {
            id: "ev-5",
            documentTitle: "P-101 Maintenance Manual",
            status: "Conflicting",
            revision: "Revision 0 (Out of date)",
            date: "Mar 15, 2021",
            page: "6.3",
            excerpt: "Use ISO VG 46 mineral oil. Maintain oil level between MIN and MAX marks on the sight glass.",
            includedIn: {
              equipmentName: "Filler 02",
              projectName: "Plant Expansion Project",
            },
          },
        ],
        searchedScope: [
          { type: "Equipment", name: "Filler 02" },
          { type: "Project", name: "Plant Expansion Project" },
        ],
        safetyBoundary: {
          title: "Safety boundary",
          text: "This guidance is for general troubleshooting only. Follow all Lockout/Tagout procedures and site safety policies. If the issue persists or is unsafe to address, escalate to qualified maintenance personnel.",
        },
        followUps: [
          "Show pressure control valve inspection steps",
          "List required tools",
          "Show pressure transmitter calibration steps",
        ],
      },
    ],
  },
  {
    id: "conveyor-11-alignment",
    title: "Conveyor 11 alignment check",
    updatedAt: "9:37 AM",
    timestampLabel: "9:37 AM",
    group: "Today",
    turns: [
      {
        id: "turn-c11",
        clientTurnId: "turn-uuid-2",
        question: "How do I check the belt alignment on Conveyor 11?",
        assignedReferences: [
          { type: "EQUIPMENT", id: "eq-conveyor-11", name: "Conveyor 11" },
        ],
        timestamp: "9:37 AM",
        state: "COMPLETED",
        status: "approved",
        answer: {
          summary: "Follow standard mechanical belt tracking procedure for Conveyor 11.",
          steps: [
            { id: "cs1", text: "Inspect head and tail pulley squareness to frame using laser measure." },
            { id: "cs2", text: "Adjust take-up screws evenly on both sides until belt centers under low tension." },
            { id: "cs3", text: "Run conveyor at low speed (10 RPM) and observe tracking for 3 full belt revolutions." },
          ],
        },
        safetyBoundary: {
          title: "Safety boundary",
          text: "Ensure all guards are reinstalled prior to operating at full line speed.",
        },
        followUps: ["List belt tension specs", "Check pulley bearings"],
      },
    ],
  },
  {
    id: "line-3-lockout",
    title: "Line 3 lockout review",
    updatedAt: "8:58 AM",
    timestampLabel: "8:58 AM",
    group: "Today",
    turns: [],
  },
  {
    id: "capper-04-torque",
    title: "Capper 04 torque variation",
    updatedAt: "8:12 AM",
    timestampLabel: "8:12 AM",
    group: "Today",
    turns: [],
  },
  {
    id: "palletizer-02-cycle",
    title: "Palletizer 02 cycle",
    updatedAt: "Yesterday",
    timestampLabel: "Yesterday",
    group: "Yesterday",
    turns: [],
  },
  {
    id: "boiler-feed-pump",
    title: "Boiler feed pump",
    updatedAt: "Yesterday",
    timestampLabel: "Yesterday",
    group: "Yesterday",
    turns: [],
  },
  {
    id: "vision-system-lighting",
    title: "Vision system lighting",
    updatedAt: "Tue",
    timestampLabel: "Tue",
    group: "Earlier this week",
    turns: [],
  },
];
