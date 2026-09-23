import { ProcedureEditorWorkspace } from "@/components/project-workflows";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; procedureId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const values = await params;
  const { version } = await searchParams;
  return <ProcedureEditorWorkspace {...values} versionId={version} />;
}
