"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getAlertFeed,
  getGlobalSummary,
  type GlobalSitePoint,
} from "@/app/global-operations/data";
import { GlobalAlertTicker } from "@/components/global-operations/global-alert-ticker";
import { GlobalHeader } from "@/components/global-operations/global-header";
import { GlobalMapLegend } from "@/components/global-operations/global-map-legend";
import { GlobalMapScene } from "@/components/global-operations/global-map-scene";
import { GlobalOperationsShell } from "@/components/global-operations/global-operations-shell";
import { GlobalStatsHud } from "@/components/global-operations/global-stats-hud";
import RobotInspectionModal from "@/components/robot-inspection-modal";
import {
  QINGHAI_SITE_ID,
  startQinghaiSitePatrol,
  subscribeQinghaiSitePatrolEvents,
} from "@/lib/robot-inspection/site-patrol";
import type { RobotInspectionEvent } from "@/lib/robot-inspection/types";
import { useRobotInspection } from "@/lib/robot-inspection/use-robot-inspection";

type GlobalOperationsClientProps = {
  points: GlobalSitePoint[];
};

type PatrolStage = "idle" | "starting" | "dispatching" | "anomaly";

type ToastState = {
  tone: "info" | "critical";
  message: string;
};

export function GlobalOperationsClient({
  points,
}: GlobalOperationsClientProps) {
  const router = useRouter();
  const { beginInspection, closeDialog, dialogState } = useRobotInspection();
  const processedEventKeysRef = useRef<Set<string>>(new Set());
  const [patrolStage, setPatrolStage] = useState<PatrolStage>("idle");
  const [inspectionSiteId, setInspectionSiteId] = useState<string | null>(null);
  const [anomalySiteId, setAnomalySiteId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const activeSiteId = inspectionSiteId ?? QINGHAI_SITE_ID;

  const pointsWithSimulationState = useMemo<GlobalSitePoint[]>(
    () =>
      points.map((point) => {
        if (point.id !== activeSiteId || patrolStage === "idle") {
          return point;
        }

        return {
          ...point,
          details: {
            ...point.details,
            robotStatus:
              patrolStage === "dispatching" || patrolStage === "starting"
                ? "执行中"
                : "在线待命",
            todayInspectionStatus:
              patrolStage === "anomaly" ? "已完成" : "巡检中",
            anomalyReviewStatus: patrolStage === "anomaly" ? "待复核1项" : "无待复核",
          },
        };
      }),
    [activeSiteId, patrolStage, points],
  );

  const summary = useMemo(
    () => getGlobalSummary(pointsWithSimulationState),
    [pointsWithSimulationState],
  );

  const alerts = useMemo(() => {
    const baseAlerts = getAlertFeed(pointsWithSimulationState);

    if (patrolStage !== "anomaly") {
      return baseAlerts;
    }

    return [
      "青海场站支架NCU N5 参数异常，已同步至场站监控平台",
      ...baseAlerts,
    ];
  }, [patrolStage, pointsWithSimulationState]);

  const handleStartInspection = useCallback(async () => {
    setInspectionSiteId(QINGHAI_SITE_ID);
    setPatrolStage("starting");

    try {
      await startQinghaiSitePatrol();
    } catch (error) {
      setPatrolStage("idle");
      setToast({
        tone: "critical",
        message:
          error instanceof Error
            ? error.message
            : "机器人巡检启动失败，请稍后重试。",
      });
    }
  }, []);

  const handleOpenAnomalyReview = useCallback(
    async (site: GlobalSitePoint) => {
      await beginInspection(
        {
          siteId: site.id,
          nodeId: "ncu-5",
          nodeLabel: "N5",
        },
        () => {
          const query = new URLSearchParams({
            nodeType: "ncu",
            nodeLabel: "N5",
            nodeId: "ncu-5",
            hasWorkOrder: "1",
            returnTo: `/sites/${site.id}/2d?reviewNodeId=ncu-5`,
          });

          router.push(`/sites/${site.id}/devices/inverter-b?${query.toString()}`);
        },
      );
    },
    [beginInspection, router],
  );

  const handleOpenSiteDetail = useCallback((site: GlobalSitePoint) => {
    router.push(`/sites/${site.id}/2d`);
  }, [router]);

  useEffect(() => {
    let closedDueToError = false;

    const applyPatrolEvent = (event: RobotInspectionEvent) => {
      const eventKey = `${event.requestId}:${event.event}`;
      if (processedEventKeysRef.current.has(eventKey)) {
        return;
      }
      processedEventKeysRef.current.add(eventKey);

      if (event.siteId) {
        setInspectionSiteId(event.siteId);
      }

      if (event.event === "patrol_started") {
        setPatrolStage("dispatching");
        setAnomalySiteId(null);
        setToast({
          tone: "info",
          message: event.message ?? "机器人消息：已接收巡检任务，当前进入青海场站巡检模式",
        });
        return;
      }

      if (event.event === "patrol_anomaly_detected") {
        setPatrolStage("anomaly");
        setAnomalySiteId(event.siteId ?? QINGHAI_SITE_ID);
        setToast({
          tone: "critical",
          message:
            event.message ??
            "发生巡检事件：检测到青海场站支架NCU N5 参数异常，已同步至场站监控，点击查看详细信息。",
        });
        return;
      }

      if (event.event === "patrol_failed") {
        setPatrolStage("idle");
        setAnomalySiteId(null);
        setToast({
          tone: "critical",
          message: event.message ?? "机器人巡检失败，请稍后重试。",
        });
        return;
      }

      if (event.event === "patrol_completed") {
        setPatrolStage("idle");
        setInspectionSiteId(null);
        setAnomalySiteId(null);
        setToast(null);
      }
    };

    const eventSource = subscribeQinghaiSitePatrolEvents(applyPatrolEvent, () => {
      if (!closedDueToError) {
        closedDueToError = true;
        eventSource.close();
      }

      setToast({
        tone: "critical",
        message: "机器人巡检事件通道已断开，请检查桥接服务连接。",
      });
    });

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket("ws://10.180.40.165:8801/ws/plant-created");

    socket.addEventListener("open", () => {
      console.log("[global-operations] plant-created websocket connected");
    });

    socket.addEventListener("message", (event) => {
      console.log("[global-operations] plant-created raw message:", event.data);

      if (typeof event.data !== "string") {
        return;
      }

      try {
        const payload = JSON.parse(event.data);
        console.log("[global-operations] plant-created parsed message:", payload);
      } catch {
        console.log("[global-operations] plant-created message is not JSON");
      }
    });

    socket.addEventListener("error", (event) => {
      console.log("[global-operations] plant-created websocket error:", event);
    });

    socket.addEventListener("close", (event) => {
      console.log("[global-operations] plant-created websocket closed:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    });

    return () => {
      socket.close();
    };
  }, []);

  return (
    <GlobalOperationsShell
      toast={toast ? <TopToast tone={toast.tone} message={toast.message} /> : null}
      header={
        <GlobalHeader
          title="全球运维总览"
          description="统一监测全球电站链路、容量状态与异常波动。当前页面聚焦全球态势感知与链路可视，不进入场站工单处理流程。"
          actionLabel="新场站规划"
          actionHref="http://10.180.40.166/#/workspace/info/home?workflowId=new&tab=forward"
          statusLabel={
            patrolStage === "idle" ? "全局指挥就绪" : "巡检事件处理中"
          }
        />
      }
      stats={<GlobalStatsHud summary={summary} />}
      scene={
        <GlobalMapScene
          points={pointsWithSimulationState}
          anomalySiteId={anomalySiteId}
          inspectionBusy={patrolStage === "starting" || patrolStage === "dispatching"}
          onStartInspection={handleStartInspection}
          onOpenAnomalyReview={handleOpenAnomalyReview}
          onOpenSiteDetail={handleOpenSiteDetail}
        />
      }
      legend={<GlobalMapLegend summary={summary} />}
      ticker={<GlobalAlertTicker alerts={alerts} />}
    >
      <RobotInspectionModal
        open={dialogState.open}
        loading={dialogState.loading}
        message={dialogState.message}
        error={dialogState.error}
        onClose={closeDialog}
      />
    </GlobalOperationsShell>
  );
}

function TopToast({
  tone,
  message,
}: {
  tone: "info" | "critical";
  message: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-full border px-5 py-3 shadow-[0_22px_50px_rgba(103,146,181,0.18)] backdrop-blur-xl ${
        tone === "critical"
          ? "border-red-200/90 bg-white/92 text-red-700"
          : "border-sky-100 bg-white/92 text-sky-800"
      }`}
    >
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
          tone === "critical"
            ? "bg-red-50 text-red-600 ring-1 ring-red-100"
            : "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
        }`}
      >
        {tone === "critical" ? "!" : "•"}
      </span>
      <p className="max-w-[860px] text-sm font-semibold leading-6">
        {message}
      </p>
    </div>
  );
}
