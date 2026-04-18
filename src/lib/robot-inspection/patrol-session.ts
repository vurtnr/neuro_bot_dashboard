"use client";

import type { PersistedPatrolSession } from "./types";

const STORAGE_KEY = "robot-dashboard:patrol-session";

function isPatrolLockedDevice(value: unknown): value is PersistedPatrolSession["lockedDevice"] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.nodeId === "string" &&
    typeof record.nodeLabel === "string" &&
    typeof record.nodeType === "string" &&
    typeof record.deviceCategory === "string"
  );
}

function sanitizePersistedSession(value: unknown): PersistedPatrolSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.requestId !== "string" ||
    typeof record.siteId !== "string" ||
    record.status !== "locked" ||
    !isPatrolLockedDevice(record.lockedDevice)
  ) {
    return null;
  }

  return {
    requestId: record.requestId,
    siteId: record.siteId,
    status: "locked",
    lockedDevice: record.lockedDevice,
  };
}

export function readPatrolSession(): PersistedPatrolSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    return sanitizePersistedSession(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function getPatrolSessionForSite(siteId: string): PersistedPatrolSession | null {
  const session = readPatrolSession();
  if (!session || session.siteId !== siteId) {
    return null;
  }

  return session;
}

export function writePatrolSession(session: PersistedPatrolSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearPatrolSession(requestId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (!requestId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const existingSession = readPatrolSession();
  if (existingSession?.requestId === requestId) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function matchesPatrolLockedDevice(
  session: PersistedPatrolSession | null,
  siteId: string,
  nodeId: string,
): boolean {
  return Boolean(
    session &&
      session.siteId === siteId &&
      session.status === "locked" &&
      session.lockedDevice.nodeId === nodeId,
  );
}
