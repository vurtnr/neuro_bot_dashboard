const STORAGE_KEY = "robot-dashboard:resolved-work-orders";

type ResolvedWorkOrderState = Record<string, string[]>;

function sanitizeState(value: unknown): ResolvedWorkOrderState {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([siteId, nodeIds]) => [
      siteId,
      Array.isArray(nodeIds)
        ? nodeIds.filter((nodeId): nodeId is string => typeof nodeId === "string")
        : [],
    ]),
  );
}

function readResolvedWorkOrderState(): ResolvedWorkOrderState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    return sanitizeState(JSON.parse(rawValue));
  } catch {
    return {};
  }
}

function writeResolvedWorkOrderState(state: ResolvedWorkOrderState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getResolvedWorkOrderNodeIds(siteId: string): string[] {
  return readResolvedWorkOrderState()[siteId] ?? [];
}

export function isWorkOrderResolved(siteId: string, nodeId: string): boolean {
  return getResolvedWorkOrderNodeIds(siteId).includes(nodeId);
}

export function markWorkOrderResolved(siteId: string, nodeId: string) {
  const state = readResolvedWorkOrderState();
  const nodeIds = new Set(state[siteId] ?? []);

  nodeIds.add(nodeId);
  state[siteId] = [...nodeIds];

  writeResolvedWorkOrderState(state);
}
