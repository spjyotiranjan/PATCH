import { SourceWorkspace } from "@/components/document-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ documentVersionId: string }>;
}) {
  const { documentVersionId } = await params;
  return <SourceWorkspace versionId={documentVersionId} />;
}
