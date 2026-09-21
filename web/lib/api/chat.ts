import type {
  Assignment,
  ChatMessage,
  ChatSession,
  EvidenceSource,
  SendMessageInput,
} from "@/lib/types/chat";

import {
  mockAssignmentOptions,
  mockCreateChatSession,
  mockGetChatMessages,
  mockGetChatSession,
  mockGetChatSessions,
  mockGetEvidence,
  mockSendChatMessage,
} from "@/lib/mockapi/chat";

/**
 * Chat service boundary.
 *
 * UI code consumes these functions. A future real retrieval/LLM
 * backend replaces the mock implementation inside this module
 * without touching pages or components.
 */

export async function getChatSessions(): Promise<
  ChatSession[]
> {
  return mockGetChatSessions();
}

export async function getChatSession(
  sessionId: string,
): Promise<ChatSession | null> {
  return mockGetChatSession(sessionId);
}

export async function createChatSession(
  title?: string,
): Promise<ChatSession> {
  return mockCreateChatSession(title);
}

export async function getChatMessages(
  sessionId: string,
): Promise<ChatMessage[]> {
  return mockGetChatMessages(sessionId);
}

export async function getEvidence(
  sessionId: string,
): Promise<EvidenceSource[]> {
  return mockGetEvidence(sessionId);
}

export function getAssignmentOptions(): Assignment[] {
  return mockAssignmentOptions();
}

export async function sendChatMessage(
  input: SendMessageInput,
): Promise<ChatMessage> {
  return mockSendChatMessage(input);
}
