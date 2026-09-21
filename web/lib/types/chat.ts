export type AssignmentType = "DOCUMENT" | "EQUIPMENT" | "PROJECT";

export type Assignment = {
  id: string;
  type: AssignmentType;
  label: string;
  entityId: string;
};

export type EvidenceSource = {
  id: string;
  documentTitle: string;
  documentVersionId: string;
  revision: string;
  page: number | null;
  section: string | null;
  status: "ACTIVE" | "SUPERSEDED" | "NEEDS_REVIEW";
  approvalState: "APPROVED" | "PENDING" | "REJECTED";
  excerpt: string;
  inclusionPath: string;
  equipmentName?: string;
  projectName?: string;
};

export type MessageRole = "USER" | "ASSISTANT";

export type ChatMessageState =
  | "COMPLETE"
  | "STREAMING"
  | "ERROR"
  | "NO_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING_EVIDENCE"
  | "SOURCE_UNAVAILABLE";

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  state: ChatMessageState;
  evidence: EvidenceSource[];
  searchedIn: string[];
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  lastMessage: string;
  assignments: Assignment[];
  createdAt: string;
  updatedAt: string;
};

export type SendMessageInput = {
  sessionId: string;
  content: string;
  assignments: Assignment[];
};
