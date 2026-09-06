import { authenticatedApiRoute } from "@/lib/api/route";
import { getServerConfig } from "@/lib/config";
import { ensureDatabaseBootstrap } from "@/lib/database/bootstrap";
import { getDatabase } from "@/lib/database/mongodb";
import { fail } from "@/lib/backend/context";
import { matchEndpoint } from "@/lib/backend/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const wrapped = authenticatedApiRoute(async (request, { actor, requestId }) => {
  if (!actor) fail("AUTHENTICATION_REQUIRED", 401);
  const match = matchEndpoint(request.method, new URL(request.url).pathname);
  if (!match) fail("ENDPOINT_NOT_FOUND", 404);
  const config = getServerConfig();
  await ensureDatabaseBootstrap(config);
  const result = await match.endpoint.execute(
    { actor, requestId, config, db: getDatabase(config) },
    match.params,
    request,
  );
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
});
const handler = (request: Request) => wrapped(request);
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
