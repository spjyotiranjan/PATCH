import { DocumentsWorkspace } from "@/components/document-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const { equipmentId } = await params;
  return <DocumentsWorkspace entity={{ type: "EQUIPMENT", id: equipmentId }} />;
}
