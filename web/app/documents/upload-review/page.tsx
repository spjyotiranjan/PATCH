import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ versionId?: string }>;
}) {
  const { versionId } = await searchParams;
  redirect(
    versionId ? `/documents/${encodeURIComponent(versionId)}` : "/documents",
  );
}
