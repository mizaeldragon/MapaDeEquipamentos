import { api } from "./client";

export type DeviceStatus = "up" | "warn" | "down";
export type DeviceType = "hub" | "switch" | "router" | "ap" | "server";
export type LinkStatus = "up" | "warn" | "down";

export type TopologyNode = {
  id: string;
  type: "device";
  position: { x: number; y: number };
  data: { name: string; type: DeviceType; ip?: string; status: DeviceStatus };
};

export type TopologyEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: { status?: LinkStatus };
  sourceHandle?: string;
  targetHandle?: string;
};

export type TopologyResponse = { nodes: TopologyNode[]; edges: TopologyEdge[] };

// ---- GET ----
export function fetchTopology() {
  return api<TopologyResponse>("/topology");
}

// ---- Devices ----
export function createDevice(payload: {
  name: string;
  type: DeviceType;
  ip?: string;
  status?: DeviceStatus;
  x?: number;
  y?: number;
}) {
  return api("/devices", { method: "POST", json: payload });
}

export function patchDevicePosition(id: string, x: number, y: number) {
  return api(`/devices/${id}/position`, { method: "PATCH", json: { x, y } });
}

export function patchDeviceStatus(id: string, status: DeviceStatus) {
  return api(`/devices/${id}`, { method: "PATCH", json: { status } });
}

export function deleteDevice(id: string) {
  return api(`/devices/${id}`, { method: "DELETE" });
}

// ---- Links ----
export function createLink(payload: {
  fromId: string;
  toId: string;
  status?: LinkStatus;
  label?: string;
  fromHandle?: string;
  toHandle?: string;
}) {
  return api("/links", { method: "POST", json: payload });
}

export function patchLinkStatus(id: string, status: LinkStatus) {
  return api(`/links/${id}`, { method: "PATCH", json: { status } });
}

export function deleteLink(id: string) {
  return api(`/links/${id}`, { method: "DELETE" });
}
