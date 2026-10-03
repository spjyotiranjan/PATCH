import { LiveChat } from "@/components/live-chat";
export default async function Page({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <LiveChat key={conversationId} sessionId={conversationId} />;
}
