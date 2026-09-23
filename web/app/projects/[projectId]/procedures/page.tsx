import { ProceduresWorkspace } from "@/components/project-workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProceduresWorkspace projectId={projectId} />;
}
