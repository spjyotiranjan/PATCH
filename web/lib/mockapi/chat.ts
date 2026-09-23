import type {
  Assignment,
  ChatMessage,
  ChatSession,
  EvidenceSource,
  SendMessageInput,
} from "@/lib/types/chat";

/* ------------------------------------------------------------------ */
/* Stable mock data                                                     */
/* ------------------------------------------------------------------ */

let sessions: ChatSession[] = [
  {
    id: "session-1",
    title: "Boiler feed pump pressure issue",
    lastMessage:
      "What should I check if the discharge pressure drops?",
    assignments: [
      {
        id: "assign-1",
        type: "EQUIPMENT",
        label: "Boiler B-201",
        entityId: "eq-002",
      },
    ],
    createdAt: "2026-09-21T10:30:00Z",
    updatedAt: "2026-09-21T10:42:00Z",
  },
  {
    id: "session-2",
    title: "Conveyor 11 alignment",
    lastMessage:
      "What is the approved alignment procedure?",
    assignments: [],
    createdAt: "2026-09-21T09:20:00Z",
    updatedAt: "2026-09-21T09:37:00Z",
  },
  {
    id: "session-3",
    title: "Line 3 lockout review",
    lastMessage:
      "Show the current lockout requirements.",
    assignments: [],
    createdAt: "2026-09-21T08:40:00Z",
    updatedAt: "2026-09-21T08:58:00Z",
  },
  {
    id: "session-4",
    title: "Capper 04 torque",
    lastMessage:
      "What torque range is specified for Capper 04?",
    assignments: [],
    createdAt: "2026-09-21T08:00:00Z",
    updatedAt: "2026-09-21T08:12:00Z",
  },
  {
    id: "session-5",
    title: "Palletizer 02 cycle",
    lastMessage:
      "The palletizer cycle is taking longer than normal.",
    assignments: [],
    createdAt: "2026-09-20T15:00:00Z",
    updatedAt: "2026-09-20T15:20:00Z",
  },
  {
    id: "session-6",
    title: "Boiler feed pump maintenance",
    lastMessage:
      "Show the latest maintenance information.",
    assignments: [],
    createdAt: "2026-09-20T11:00:00Z",
    updatedAt: "2026-09-20T11:15:00Z",
  },
  {
    id: "session-7",
    title: "Vision system lighting",
    lastMessage:
      "Which document covers the lighting configuration?",
    assignments: [],
    createdAt: "2026-09-16T10:00:00Z",
    updatedAt: "2026-09-16T10:12:00Z",
  },
];

const evidenceLibrary: EvidenceSource[] = [
  {
    id: "ev-1",
    documentTitle: "Boiler Operations Manual",
    documentVersionId: "ver-doc-ops-42",
    revision: "Rev. 4.2",
    page: 42,
    section: "Section 5.3 — Feedwater pressure",
    status: "ACTIVE",
    approvalState: "APPROVED",
    excerpt:
      "Verify suction pressure, inspect the inlet strainer, and confirm that the feedwater pump isolation valves are fully open.",
    inclusionPath:
      "Directly mapped to Boiler B-201",
    equipmentName: "Boiler B-201",
  },
  {
    id: "ev-2",
    documentTitle: "Boiler Maintenance Procedure",
    documentVersionId: "ver-doc-maint-31",
    revision: "Rev. 3.1",
    page: 18,
    section: "Section 4 — Pump inspection",
    status: "ACTIVE",
    approvalState: "APPROVED",
    excerpt:
      "Check pump suction conditions before inspecting the discharge side. Record abnormal vibration or pressure readings.",
    inclusionPath:
      "Inherited through Boiler B-201",
    equipmentName: "Boiler B-201",
  },
];

const messages: Record<string, ChatMessage[]> = {
  "session-1": [
    {
      id: "msg-1-user",
      sessionId: "session-1",
      role: "USER",
      content:
        "The boiler feedwater pressure is dropping. What should I check first?",
      state: "COMPLETE",
      evidence: [],
      searchedIn: ["Boiler B-201"],
      createdAt: "2026-09-21T10:42:00Z",
    },
    {
      id: "msg-1-assistant",
      sessionId: "session-1",
      role: "ASSISTANT",
      content:
        "For Boiler B-201, start by checking the feedwater pump suction conditions and inlet path. The current approved sources specifically call out suction pressure, the inlet strainer, and the pump isolation valves.\n\nIf those are normal, inspect the pump for abnormal vibration or other signs of operating issues before moving to the discharge side.",
      state: "COMPLETE",
      evidence: evidenceLibrary,
      searchedIn: [
        "Boiler B-201",
        "Boiler Upgrade Project",
      ],
      createdAt: "2026-09-21T10:42:30Z",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function delay(ms: number) {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, ms),
  );
}

/* ------------------------------------------------------------------ */
/* Chat sessions                                                        */
/* ------------------------------------------------------------------ */

export async function mockGetChatSessions(): Promise<
  ChatSession[]
> {
  await delay(250);
  return [...sessions];
}

export async function mockGetChatSession(
  sessionId: string,
): Promise<ChatSession | null> {
  await delay(200);
  return (
    sessions.find(
      (session) => session.id === sessionId,
    ) ?? null
  );
}

export async function mockCreateChatSession(
  title = "New conversation",
): Promise<ChatSession> {
  await delay(250);
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: `session-${Date.now()}`,
    title,
    lastMessage: "",
    assignments: [],
    createdAt: now,
    updatedAt: now,
  };
  sessions = [session, ...sessions];
  messages[session.id] = [];
  return session;
}

/* ------------------------------------------------------------------ */
/* Messages and evidence                                                */
/* ------------------------------------------------------------------ */

export async function mockGetChatMessages(
  sessionId: string,
): Promise<ChatMessage[]> {
  await delay(250);
  return [...(messages[sessionId] ?? [])];
}

export async function mockGetEvidence(
  sessionId: string,
): Promise<EvidenceSource[]> {
  await delay(200);
  const sessionMessages =
    messages[sessionId] ?? [];
  const seen = new Set<string>();
  const evidence: EvidenceSource[] = [];
  for (const message of sessionMessages) {
    for (const source of message.evidence) {
      if (!seen.has(source.id)) {
        seen.add(source.id);
        evidence.push(source);
      }
    }
  }
  return evidence;
}

export function mockAssignmentOptions(): Assignment[] {
  return [
    {
      id: "assign-doc-1",
      type: "DOCUMENT",
      label: "Boiler Operations Manual",
      entityId: "doc-ops",
    },
    {
      id: "assign-eq-1",
      type: "EQUIPMENT",
      label: "Boiler B-201",
      entityId: "eq-002",
    },
    {
      id: "assign-eq-2",
      type: "EQUIPMENT",
      label: "Boiler Feed Pump P-101",
      entityId: "eq-001",
    },
    {
      id: "assign-prj-1",
      type: "PROJECT",
      label: "Boiler Upgrade Project",
      entityId: "prj-001",
    },
  ];
}

/**
 * Simulated retrieval: returns grounded evidence when the question
 * matches known coverage, an insufficient-evidence state when the
 * scope is empty, and a conflicting-evidence state when the question
 * mentions conflict keywords. Never fabricates procedure steps.
 */
export async function mockSendChatMessage(
  input: SendMessageInput,
): Promise<ChatMessage> {
  await delay(900);
  const now = new Date().toISOString();
  const question = input.content.toLowerCase();

  const userMessage: ChatMessage = {
    id: `msg-${Date.now()}-user`,
    sessionId: input.sessionId,
    role: "USER",
    content: input.content,
    state: "COMPLETE",
    evidence: [],
    searchedIn: input.assignments.map(
      (assignment) => assignment.label,
    ),
    createdAt: now,
  };

  let assistant: ChatMessage;
  if (
    question.includes("conflict") ||
    question.includes("differ")
  ) {
    assistant = {
      id: `msg-${Date.now()}-assistant`,
      sessionId: input.sessionId,
      role: "ASSISTANT",
      content:
        "The current sources contain different information for this question. Review the cited documents before proceeding; P.A.T.C.H. cannot resolve the difference without an approved source.",
      state: "CONFLICTING_EVIDENCE",
      evidence: evidenceLibrary,
      searchedIn: userMessage.searchedIn,
      createdAt: now,
    };
  } else if (
    input.assignments.length === 0 &&
    (question.includes("torque") ||
      question.includes("unknown") ||
      question.includes("capper"))
  ) {
    assistant = {
      id: `msg-${Date.now()}-assistant`,
      sessionId: input.sessionId,
      role: "ASSISTANT",
      content:
        "There is insufficient approved evidence to answer this safely. Assign a relevant document, Equipment, or Project, or ask about covered maintenance topics.",
      state: "INSUFFICIENT_EVIDENCE",
      evidence: [],
      searchedIn: [],
      createdAt: now,
    };
  } else {
    assistant = {
      id: `msg-${Date.now()}-assistant`,
      sessionId: input.sessionId,
      role: "ASSISTANT",
      content:
        "Based on the current approved sources, check the suction conditions first. Confirm the inlet path is clear, verify the relevant isolation valves, and compare the current reading against the approved operating information.\n\nAn unsupported assumption is not presented as a maintenance instruction. If the source does not cover the condition you are seeing, review the available source or escalate for an approved procedure.",
      state: "COMPLETE",
      evidence:
        input.assignments.length > 0
          ? evidenceLibrary
          : [],
      searchedIn: userMessage.searchedIn,
      createdAt: now,
    };
  }

  messages[input.sessionId] = [
    ...(messages[input.sessionId] ?? []),
    userMessage,
    assistant,
  ];
  sessions = sessions.map((session) =>
    session.id === input.sessionId
      ? {
          ...session,
          lastMessage: input.content,
          updatedAt: now,
        }
      : session,
  );
  return assistant;
}
