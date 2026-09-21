import type {
  CreateEquipmentInput,
  Equipment,
  EquipmentAccessRequest,
  EquipmentMember,
} from "@/lib/types/equipment";

import {
  mockApproveAccessRequest,
  mockCreateEquipment,
  mockGetAccessRequests,
  mockGetEquipment,
  mockGetEquipmentActivity,
  mockGetEquipmentMembers,
  mockGetEquipments,
  mockRejectAccessRequest,
  type EquipmentActivityEvent,
} from "@/lib/mockapi/equipments";

export async function getEquipments(): Promise<
  Equipment[]
> {
  return mockGetEquipments();
}

export async function getEquipment(
  id: string,
): Promise<Equipment | null> {
  return mockGetEquipment(id);
}

export async function createEquipment(
  input: CreateEquipmentInput,
): Promise<Equipment> {
  return mockCreateEquipment(input);
}

export async function getEquipmentMembers(
  equipmentId: string,
): Promise<EquipmentMember[]> {
  return mockGetEquipmentMembers(
    equipmentId,
  );
}

export async function getEquipmentAccessRequests(
  equipmentId: string,
): Promise<EquipmentAccessRequest[]> {
  return mockGetAccessRequests(
    equipmentId,
  );
}

export async function approveEquipmentAccessRequest(
  equipmentId: string,
  requestId: string,
) {
  return mockApproveAccessRequest(
    equipmentId,
    requestId,
  );
}

export async function rejectEquipmentAccessRequest(
  equipmentId: string,
  requestId: string,
) {
  return mockRejectAccessRequest(
    equipmentId,
    requestId,
  );
}

export async function getEquipmentActivity(
  equipmentId: string,
): Promise<EquipmentActivityEvent[]> {
  return mockGetEquipmentActivity(
    equipmentId,
  );
}