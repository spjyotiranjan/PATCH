import { afterEach, expect, it, vi } from "vitest";
import {
  getEquipmentRecord,
  getProjectRecord,
  createEquipmentRecord,
  createProjectRecord,
  updateEntity,
} from "@/lib/api/resources";

afterEach(() => vi.unstubAllGlobals());

it.each(["equipments", "projects"] as const)(
  "%s detail, create and update unwrap the route response envelope",
  async (kind) => {
    const record =
      kind === "equipments"
        ? {
            id: "equipment-id",
            name: "Test pump",
            operationalState: "UNKNOWN",
            accessLevel: "OWNER",
          }
        : {
            id: "project-id",
            name: "Test inspection",
            status: "ACTIVE",
            role: "OWNER",
            includedEquipmentIds: ["equipment-id"],
          };
    const envelope =
      kind === "equipments" ? { equipment: record } : { project: record };
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(envelope)));
    vi.stubGlobal("fetch", fetchMock);

    const read = kind === "equipments" ? getEquipmentRecord : getProjectRecord;
    expect(await read(record.id)).toEqual(record);
    const created =
      kind === "equipments"
        ? await createEquipmentRecord({
            name: record.name,
            type: "Pump",
            location: "Test bay",
            documentsMode: "SKIP_FOR_NOW",
          })
        : await createProjectRecord({
            name: record.name,
            description: "Synthetic inspection",
            status: "ACTIVE",
            includedEquipmentIds: ["equipment-id"],
            documentsMode: "SKIP_FOR_NOW",
          });
    expect(created.id).toBe(record.id);
    expect(created).toEqual(record);
    expect(await updateEntity(kind, record.id, { name: "Updated" })).toEqual(
      record,
    );
    expect(
      fetchMock.mock.calls.map(([path, options]) => [
        path,
        options.method ?? "GET",
      ]),
    ).toEqual([
      [`/api/${kind}/${record.id}`, "GET"],
      [`/api/${kind}`, "POST"],
      [`/api/${kind}/${record.id}`, "PATCH"],
    ]);
  },
);
