import type { PatrolLockedDevice, RobotInspectionEvent } from "./types";

export type PatrolRuntimeStatus =
  | "idle"
  | "starting"
  | "dispatching"
  | "anomaly"
  | "error";

export type PatrolContractState = {
  status: PatrolRuntimeStatus;
  requestId: string | null;
  lockedDevice: PatrolLockedDevice | null;
  message: string;
  error: string;
};

export function isSupportedPatrolSite(siteId: string) {
  return siteId === "qinghai-gonghexian";
}

export function getSupportedPatrolSiteMessage(siteId: string) {
  return isSupportedPatrolSite(siteId)
    ? ""
    : `当前机器人巡检链路仅接入青海场站，暂不支持 ${siteId} 发起巡检。`;
}

export function buildLockedDeviceFromPatrolEvent(
  event: RobotInspectionEvent,
): PatrolLockedDevice {
  return {
    nodeId: event.nodeId ?? "ncu-5",
    nodeLabel: event.nodeLabel ?? "N5",
    nodeType: "ncu",
    deviceCategory: "ncu",
  };
}

export function reducePatrolState(
  current: PatrolContractState,
  event: RobotInspectionEvent,
): PatrolContractState {
  if (event.event === "patrol_started") {
    return {
      ...current,
      status: "dispatching",
      requestId: event.requestId,
      message: event.message ?? "机器人已接收巡检请求，正在进入自动巡检状态。",
      error: "",
    };
  }

  if (event.event === "patrol_anomaly_detected") {
    return {
      status: "anomaly",
      requestId: event.requestId,
      lockedDevice: buildLockedDeviceFromPatrolEvent(event),
      message:
        event.message ??
        "发生巡检事件：检测到青海场站支架NCU N5 参数异常，点击查看详细信息。",
      error: "",
    };
  }

  if (event.event === "patrol_failed") {
    return {
      status: "error",
      requestId: null,
      lockedDevice: null,
      message: "",
      error: event.message ?? "机器人巡检失败，请稍后重试。",
    };
  }

  if (event.event === "patrol_completed") {
    return {
      status: "idle",
      requestId: null,
      lockedDevice: null,
      message: "",
      error: "",
    };
  }

  return current;
}
