import { RunWorkspace } from "@/components/project-workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; procedureId: string; runId: string }>;
}) {
  return <RunWorkspace {...await params} />;
}
