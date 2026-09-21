/**
 * Conversation-view mock data for the global Chat transcript.
 *
 * These shapes power the transcript, assignment chips, inline
 * citations, and the Evidence Used drawer. A future retrieval
 * backend replaces the simulated send flow in the page without
 * changing these contracts.
 */

export type ConversationAssignmentType =
  | "document"
  | "equipment"
  | "project"
  | "entity";

export type ConversationAssignment = {
  id: string;
  type: ConversationAssignmentType;
  name: string;
};

export type ConversationEvidence = {
  id: string;
  title: string;
  revision: string;
  page: string;
  section: string;
  status: "Current" | "Needs review" | "Unavailable";
  approval: string;
  excerpt: string;
  inclusionPath: string;
};

export type ConversationMessageState =
  | "normal"
  | "insufficient"
  | "conflicting"
  | "outdated"
  | "unavailable";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: string[];
  searchedIn?: string[];
  state?: ConversationMessageState;
  time: string;
};

export const ASSIGNMENT_OPTIONS: ConversationAssignment[] =
  [
    {
      id: "doc-1",
      type: "document",
      name: "Boiler Operations Manual",
    },
    {
      id: "doc-2",
      type: "document",
      name: "Boiler Maintenance Procedure",
    },
    {
      id: "eq-1",
      type: "equipment",
      name: "Boiler B-201",
    },
    {
      id: "eq-2",
      type: "equipment",
      name: "Boiler Feed Pump P-101",
    },
    {
      id: "project-1",
      type: "project",
      name: "Boiler Upgrade Project",
    },
    {
      id: "entity-1",
      type: "entity",
      name: "Boiler House",
    },
  ];

export const CONVERSATION_EVIDENCE: ConversationEvidence[] =
  [
    {
      id: "ev-1",
      title: "Boiler Operations Manual",
      revision: "Rev. 4.2",
      page: "Page 42",
      section: "Section 5.3 — Feedwater pressure",
      status: "Current",
      approval: "Approved",
      excerpt:
        "Verify suction pressure, inspect the inlet strainer, and confirm that the feedwater pump isolation valves are fully open.",
      inclusionPath:
        "Directly mapped to Boiler B-201",
    },
    {
      id: "ev-2",
      title: "Boiler Maintenance Procedure",
      revision: "Rev. 3.1",
      page: "Page 18",
      section: "Section 4 — Pump inspection",
      status: "Current",
      approval: "Approved",
      excerpt:
        "Check pump suction conditions before inspecting the discharge side. Record abnormal vibration or pressure readings.",
      inclusionPath:
        "Inherited through Boiler B-201",
    },
    {
      id: "ev-3",
      title: "Boiler Upgrade Project — Scope",
      revision: "Rev. 2.0",
      page: "Page 11",
      section: "Section 2.4 — Feedwater system",
      status: "Current",
      approval: "Approved",
      excerpt:
        "Feedwater equipment associated with the upgrade shall remain within the approved project maintenance boundary.",
      inclusionPath: "Direct Project Document",
    },
  ];

export const INITIAL_MESSAGES: ConversationMessage[] =
  [
    {
      id: "m-1",
      role: "user",
      text: "The boiler feedwater pressure is dropping. What should I check first?",
      time: "10:42 AM",
    },
    {
      id: "m-2",
      role: "assistant",
      text: "For Boiler B-201, start by checking the feedwater pump suction conditions and inlet path. The current approved sources specifically call out suction pressure, the inlet strainer, and the pump isolation valves.\n\nIf those are normal, inspect the pump for abnormal vibration or other signs of operating issues before moving to the discharge side.",
      citations: ["ev-1", "ev-2"],
      searchedIn: [
        "Boiler B-201",
        "Boiler Upgrade Project",
      ],
      time: "10:42 AM",
    },
  ];

export const DEFAULT_ASSIGNMENTS: ConversationAssignment[] =
  [
    ASSIGNMENT_OPTIONS[2],
    ASSIGNMENT_OPTIONS[3],
  ];

export const DEFAULT_TITLE = "Boiler feedwater pressure";

/**
 * Simulated retrieval answer. Returns grounded evidence when the
 * scope is assigned, an insufficient-evidence message when nothing
 * is assigned and the question is outside known coverage, and a
 * conflicting-evidence message for disagreement keywords. Never
 * fabricates procedure steps.
 */
export function mockRetrieveAnswer(
  question: string,
  assignments: ConversationAssignment[],
): {
  text: string;
  citations: string[];
  searchedIn: string[];
  state: ConversationMessageState;
} {
  const normalized = question.toLowerCase();

  if (
    normalized.includes("conflict") ||
    normalized.includes("differ")
  ) {
    return {
      text: "The current sources contain different information for this question. Review the cited documents before proceeding; P.A.T.C.H. cannot resolve the difference without an approved source.",
      citations: ["ev-1", "ev-2"],
      searchedIn: assignments.map(
        (assignment) => assignment.name,
      ),
      state: "conflicting",
    };
  }

  if (
    normalized.includes("outdated") ||
    normalized.includes("old revision") ||
    normalized.includes("superseded")
  ) {
    return {
      text: "The relevant information is only available in a superseded revision. Request the current active source version before proceeding.",
      citations: [],
      searchedIn: assignments.map(
        (assignment) => assignment.name,
      ),
      state: "outdated",
    };
  }

  if (
    normalized.includes("unavailable") ||
    normalized.includes("offline") ||
    normalized.includes("cannot access")
  ) {
    return {
      text: "A referenced source could not be accessed, so no verified answer is presented. Check source availability and retry.",
      citations: [],
      searchedIn: assignments.map(
        (assignment) => assignment.name,
      ),
      state: "unavailable",
    };
  }

  if (
    assignments.length === 0 &&
    (normalized.includes("torque") ||
      normalized.includes("unknown"))
  ) {
    return {
      text: "There is insufficient approved evidence to answer this safely. Assign a relevant document, Equipment, or Project, or ask about covered maintenance topics.",
      citations: [],
      searchedIn: [],
      state: "insufficient",
    };
  }

  return {
    text: "Based on the current approved sources, check the suction conditions first. Confirm the inlet path is clear, verify the relevant isolation valves, and compare the current reading against the approved operating information.\n\nI would not treat an unsupported assumption as a maintenance instruction. If the source does not cover the condition you are seeing, the next step is to review the available source or escalate for an approved procedure.",
    citations:
      assignments.length > 0
        ? ["ev-1", "ev-2"]
        : [],
    searchedIn: assignments
      .filter(
        (assignment) =>
          assignment.type !== "entity",
      )
      .map((assignment) => assignment.name),
    state: "normal",
  };
}
