// @vitest-environment node

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface OpenApiSchema {
  required?: string[];
  properties?: Record<string, unknown>;
}

interface OpenApiDocument {
  components: { schemas: Record<string, OpenApiSchema> };
  paths: Record<string, unknown>;
}

const contract = JSON.parse(
  readFileSync(new URL("../../ai/openapi.json", import.meta.url), "utf8"),
) as OpenApiDocument;

describe("generated Phase 2 Web-to-AI contract", () => {
  it("requires tenant and fingerprint-bound profile generation", () => {
    const request = contract.components.schemas.EntityProfileRequest;
    const provenance = contract.components.schemas.ProfileProvenance;

    expect(request.required).toEqual(
      expect.arrayContaining(["tenantId", "inputFingerprint", "entity"]),
    );
    expect(provenance.required).toEqual(
      expect.arrayContaining(["tenantId", "inputFingerprint"]),
    );
    expect(provenance.properties).toEqual(
      expect.objectContaining({
        documentVersionIds: expect.any(Object),
        includedEquipmentProfileFingerprints: expect.any(Object),
      }),
    );
  });

  it("publishes the profile and retrieval-scope endpoints and schemas", () => {
    expect(contract.paths).toHaveProperty("/v1/entity-profiles/upsert");
    expect(contract.paths).toHaveProperty("/v1/questions");
    expect(contract.components.schemas).toHaveProperty(
      "RetrievalScopeManifest",
    );
    expect(contract.components.schemas).toHaveProperty("ManifestEntity");
  });
});
