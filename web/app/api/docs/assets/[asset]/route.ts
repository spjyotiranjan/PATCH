import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
export const runtime = "nodejs";
const require = createRequire(import.meta.url);
export async function GET(
  _: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  if (!["swagger-ui.css", "swagger-ui-bundle.js"].includes(asset))
    return new Response(null, { status: 404 });
  // Ask the external package at runtime. Turbopack can rewrite require.resolve
  // into a module identifier rather than a usable filesystem path.
  const getAbsoluteFSPath =
    require("swagger-ui-dist/absolute-path.js") as () => string;
  return new Response(
    await readFile(path.join(getAbsoluteFSPath(), asset), "utf8"),
    {
      headers: {
        "Content-Type": asset.endsWith("css") ? "text/css" : "text/javascript",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
