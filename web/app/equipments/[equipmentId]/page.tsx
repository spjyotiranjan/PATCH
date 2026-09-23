import { EntityWorkspace } from "@/components/entity-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const { equipmentId } = await params;
  return <EntityWorkspace kind="equipments" entityId={equipmentId} />;
}
