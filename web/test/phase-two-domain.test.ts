// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  equipmentCreateSchema,
  equipmentUpdateSchema,
} from "../lib/domain/equipments";
import {
  projectCreateSchema,
  projectUpdateSchema,
} from "../lib/domain/projects";

describe("Phase 2 Equipment input contracts", () => {
  it("accepts an omitted Equipment description and applies safe defaults", () => {
    expect(
      equipmentCreateSchema.parse({
        name: "Boiler feed pump",
        type: "Pump",
        location: "North line",
      }),
    ).toEqual({
      name: "Boiler feed pump",
      type: "Pump",
      location: "North line",
      operationalState: "UNKNOWN",
      documentsMode: "SKIP_FOR_NOW",
    });
  });

  it("requires name, type, and location and rejects empty updates", () => {
    expect(() => equipmentCreateSchema.parse({ name: "Pump" })).toThrow();
    expect(() => equipmentUpdateSchema.parse({})).toThrow();
  });
});

describe("Phase 2 Project input contracts", () => {
  it("requires a meaningful description and deduplicated Equipment IDs", () => {
    const equipmentId = "507f1f77bcf86cd799439011";
    expect(() =>
      projectCreateSchema.parse({
        name: "North line",
        description: "short",
      }),
    ).toThrow();
    expect(() =>
      projectCreateSchema.parse({
        name: "North line",
        description: "Replace and commission the north line pump.",
        includedEquipmentIds: [equipmentId, equipmentId],
      }),
    ).toThrow();
  });

  it("applies initial workflow defaults and rejects empty updates", () => {
    expect(
      projectCreateSchema.parse({
        name: "North line",
        description: "Replace and commission the north line pump.",
      }),
    ).toMatchObject({
      status: "PLANNING",
      includedEquipmentIds: [],
      documentsMode: "SKIP_FOR_NOW",
    });
    expect(() => projectUpdateSchema.parse({})).toThrow();
  });
});
