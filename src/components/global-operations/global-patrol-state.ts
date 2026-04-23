import type { PersistedPatrolSession } from "@/lib/robot-inspection/types";

export type GlobalPatrolStage = "idle" | "starting" | "dispatching" | "anomaly";

export type GlobalPatrolUiState = {
  patrolStage: GlobalPatrolStage;
  inspectionSiteId: string | null;
  anomalySiteId: string | null;
};

export function deriveGlobalPatrolStateFromSession(
  siteId: string,
  session: PersistedPatrolSession | null,
): GlobalPatrolUiState {
  if (!session || session.siteId !== siteId) {
    return {
      patrolStage: "idle",
      inspectionSiteId: null,
      anomalySiteId: null,
    };
  }

  return {
    patrolStage: "anomaly",
    inspectionSiteId: siteId,
    anomalySiteId: siteId,
  };
}

export function isGlobalInspectionBusy(stage: GlobalPatrolStage) {
  return stage !== "idle";
}
