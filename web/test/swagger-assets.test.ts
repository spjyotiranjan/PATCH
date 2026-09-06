// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GET } from "../app/api/docs/assets/[asset]/route";

describe("local Swagger assets", () => {
  it("serves the installed CSS with safe headers", async () => {
    const result = await GET(
      new Request("http://localhost/api/docs/assets/swagger-ui.css"),
      {
        params: Promise.resolve({ asset: "swagger-ui.css" }),
      },
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("Content-Type")).toBe("text/css");
    expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await result.text()).toContain("swagger-ui");
  });
  it("does not serve arbitrary package files", async () => {
    const result = await GET(
      new Request("http://localhost/api/docs/assets/package.json"),
      {
        params: Promise.resolve({ asset: "package.json" }),
      },
    );
    expect(result.status).toBe(404);
  });
});
