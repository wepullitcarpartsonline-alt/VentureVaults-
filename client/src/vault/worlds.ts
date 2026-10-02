import { projects as seedProjects, reusableAssets as seedAssets, connections as seedConnections } from "./data";
import type { Project, ReusableAsset, Connection } from "./types";

// World placement is separate from its contents and visual representation.
export const worlds = [
  { id: "world-1", label: "WORLD 1 · ORIGINAL COPY", x: 0, y: 0 },
  { id: "world-2", label: "⚑ TEST WORLD 2", x: 2400, y: 0 },
] as const;

export function worldOrigin(worldId?: string) {
  return worlds.find((w) => w.id === worldId) ?? worlds[0];
}

export function instantiateWorld(worldId: string) {
  const source = { projects: seedProjects, assets: seedAssets, connections: seedConnections };
  const ids = new Map<string, string>();
  function collect(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if ("id" in value && typeof value.id === "string") ids.set(value.id, `${worldId}:${value.id}`);
    for (const child of Object.values(value)) collect(child);
  }
  collect(source);
  const referenceKeys = new Set(["id", "projectId", "sourceId", "from", "to", "projectIds", "reusableAssetIds"]);
  function copy(value: unknown, key = ""): unknown {
    if (typeof value === "string") return referenceKeys.has(key) ? ids.get(value) ?? value : value;
    if (Array.isArray(value)) return value.map((child) => copy(child, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v, k)]));
    return value;
  }
  const instance = copy(source) as { projects: Project[]; assets: ReusableAsset[]; connections: Connection[] };
  instance.projects.forEach((p) => {
    p.worldId = worldId;
    if (worldId === "world-2") p.name = `⚑ ${p.name}`;
  });
  instance.assets.forEach((a) => { a.worldId = worldId; });
  return instance;
}

const instances = worlds.map((world) => instantiateWorld(world.id));
export const projects = instances.flatMap((w) => w.projects);
export const reusableAssets = instances.flatMap((w) => w.assets);
export const connections = instances.flatMap((w) => w.connections);
