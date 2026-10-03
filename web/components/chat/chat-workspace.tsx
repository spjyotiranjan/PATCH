"use client";
import { LiveChat, ChatDirectory } from "@/components/live-chat";
/** Compatibility entry point; sessions always come from the authenticated API. */
export function ChatWorkspace({
  initialSessionId,
}: {
  initialSessionId?: string;
}) {
  return initialSessionId ? (
    <LiveChat key={initialSessionId} sessionId={initialSessionId} />
  ) : (
    <ChatDirectory />
  );
}
