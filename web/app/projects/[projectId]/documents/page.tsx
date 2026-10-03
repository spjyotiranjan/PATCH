import { DocumentsWorkspace } from "@/components/document-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DocumentsWorkspace entity={{ type: "PROJECT", id: projectId }} />;
}
