import { EntityWorkspace } from "@/components/entity-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <EntityWorkspace kind="projects" entityId={projectId} />;
}
