"use client";

import type { PlannedPlant } from "./planned-plant";

const STORAGE_KEY = "robot-dashboard:planned-plants";

function isPlannedPlant(value: unknown): value is PlannedPlant {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.plantId === "string" &&
    typeof record.lng === "number" &&
    typeof record.lat === "number" &&
    typeof record.name === "string" &&
    typeof record.country === "string" &&
    typeof record.province === "string" &&
    typeof record.city === "string"
  );
}

export function sanitizeStoredPlannedPlants(value: unknown): PlannedPlant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlannedPlant);
}

export function readPlannedPlants(): PlannedPlant[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    return sanitizeStoredPlannedPlants(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function writePlannedPlants(plants: PlannedPlant[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
}
