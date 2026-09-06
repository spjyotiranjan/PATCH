import { backendOpenApi } from "@/lib/backend/openapi";
export const runtime = "nodejs";
export function GET() {
  return Response.json(backendOpenApi(), {
    headers: { "Cache-Control": "no-store" },
  });
}
