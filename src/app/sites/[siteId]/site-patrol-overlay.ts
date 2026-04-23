export type SiteToastState = {
  tone: "info" | "critical";
  message: string;
  actionable?: boolean;
};

export type SitePatrolOverlayState = {
  siteToast: SiteToastState | null;
  simulatedReviewNodeId: string | null;
  highlightedNodeId: string | null;
};

type SitePatrolOverlayEvent = {
  siteId?: string;
  event: string;
  message?: string;
  nodeId?: string;
};

export function reduceSitePatrolOverlayState(
  current: SitePatrolOverlayState,
  event: SitePatrolOverlayEvent,
  siteId: string,
): SitePatrolOverlayState {
  if (event.siteId !== siteId) {
    return current;
  }

  if (event.event === "patrol_started") {
    return {
      siteToast: {
        tone: "info",
        message:
          event.message ??
          "机器人消息：已接收巡检任务，当前进入青海场站巡检模式",
      },
      simulatedReviewNodeId: null,
      highlightedNodeId: null,
    };
  }

  if (event.event === "patrol_anomaly_detected") {
    return {
      siteToast: {
        tone: "critical",
        message:
          event.message ??
          "发生巡检事件：检测到青海场站支架NCU N5 参数异常，已同步至场站监控，点击查看详细信息。",
        actionable: true,
      },
      simulatedReviewNodeId: event.nodeId ?? null,
      highlightedNodeId: current.highlightedNodeId,
    };
  }

  if (event.event === "patrol_completed") {
    return {
      siteToast: null,
      simulatedReviewNodeId: null,
      highlightedNodeId: null,
    };
  }

  return current;
}
