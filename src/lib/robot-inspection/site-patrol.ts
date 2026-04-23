"use client";

import {
  startInspection,
  subscribeGlobalInspectionEvents,
} from "./client";
import { createUuid } from "@/lib/uuid";
import type { RobotInspectionEvent } from "./types";

export const QINGHAI_SITE_ID = "qinghai-gonghexian";
export const QINGHAI_SITE_NAME = "青海场站";
export const QINGHAI_PATROL_NODE_ID = "site-patrol";
export const QINGHAI_ANOMALY_NODE_ID = "ncu-5";
export const QINGHAI_ANOMALY_NODE_LABEL = "N5";
export const QINGHAI_SUPPORT_ESCALATION_NODE_ID =
  "technical-support-escalation";
export const QINGHAI_SUPPORT_ESCALATION_NODE_LABEL = "异常状态工单";

export async function startQinghaiSitePatrol() {
  const requestId = createUuid();

  return startInspection({
    requestId,
    siteId: QINGHAI_SITE_ID,
    nodeId: QINGHAI_PATROL_NODE_ID,
    nodeLabel: "青海场站巡检",
  });
}

export async function startQinghaiTechnicalSupportEscalation() {
  const requestId = createUuid();

  return startInspection({
    requestId,
    siteId: QINGHAI_SITE_ID,
    nodeId: QINGHAI_SUPPORT_ESCALATION_NODE_ID,
    nodeLabel: QINGHAI_SUPPORT_ESCALATION_NODE_LABEL,
  });
}

export function subscribeQinghaiSitePatrolEvents(
  onEvent: (event: RobotInspectionEvent) => void,
  onError: () => void,
) {
  return subscribeGlobalInspectionEvents((event) => {
    if (event.siteId !== QINGHAI_SITE_ID) {
      return;
    }

    onEvent({
      ...event,
      siteId: event.siteId ?? QINGHAI_SITE_ID,
      siteName: event.siteName ?? QINGHAI_SITE_NAME,
      nodeId: event.nodeId ?? QINGHAI_ANOMALY_NODE_ID,
      nodeLabel: event.nodeLabel ?? QINGHAI_ANOMALY_NODE_LABEL,
    });
  }, onError);
}
