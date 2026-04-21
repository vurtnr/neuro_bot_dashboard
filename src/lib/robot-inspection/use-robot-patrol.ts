"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { clearPatrolSession, getPatrolSessionForSite, writePatrolSession } from "./patrol-session";
import {
  getSupportedPatrolSiteMessage,
  isSupportedPatrolSite,
  reducePatrolState,
  type PatrolContractState,
} from "./patrol-contract";
import {
  QINGHAI_SITE_ID,
  startQinghaiSitePatrol,
  subscribeQinghaiSitePatrolEvents,
} from "./site-patrol";
import type { PersistedPatrolSession } from "./types";

const INITIAL_STATE: PatrolContractState = {
  status: "idle",
  requestId: null,
  lockedDevice: null,
  message: "",
  error: "",
};

function buildStartErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    if (error.message === "robot_busy" || error.message === "site_patrol_busy") {
      return "机器人已处于巡检任务中，请先完成当前任务后再试。";
    }

    return error.message;
  }

  return "机器人巡检启动失败，请重试。";
}

function toAnomalyState(session: PersistedPatrolSession): PatrolContractState {
  return {
    status: "anomaly",
    requestId: session.requestId,
    lockedDevice: session.lockedDevice,
    message: "当前已锁定问题设备，请通过任务卡发起扫码连接。",
    error: "",
  };
}

function getInitialPatrolState(siteId: string): PatrolContractState {
  const persistedSession = getPatrolSessionForSite(siteId);
  return persistedSession ? toAnomalyState(persistedSession) : INITIAL_STATE;
}

export function useRobotPatrol(siteId: string) {
  const supportedSite = useMemo(() => isSupportedPatrolSite(siteId), [siteId]);
  const [state, setState] = useState<PatrolContractState>(() =>
    getInitialPatrolState(siteId),
  );

  const clearPatrolState = useCallback(
    (requestId?: string | null) => {
      clearPatrolSession(requestId ?? undefined);
      setState(INITIAL_STATE);
    },
    [],
  );

  useEffect(() => {
    if (!supportedSite || siteId !== QINGHAI_SITE_ID) {
      return;
    }

    const eventSource = subscribeQinghaiSitePatrolEvents(
      (event) => {
        setState((current) => {
          const next = reducePatrolState(current, event);

          if (next.status === "anomaly" && next.lockedDevice) {
            writePatrolSession({
              requestId: event.requestId,
              siteId,
              status: "locked",
              lockedDevice: next.lockedDevice,
            });
          }

          if (event.event === "patrol_completed" || event.event === "patrol_failed") {
            clearPatrolSession(event.requestId);
          }

          return next;
        });
      },
      () => {
        setState((current) => {
          if (current.status === "idle") {
            return current;
          }

          return {
            ...current,
            status: "error",
            error: "机器人巡检事件通道已断开，请检查桥接服务连接。",
          };
        });
      },
    );

    return () => {
      eventSource.close();
    };
  }, [siteId, supportedSite]);

  const dismissError = useCallback(() => {
    setState((current) =>
      current.lockedDevice
        ? {
            ...current,
            status: "anomaly",
            error: "",
          }
        : INITIAL_STATE,
    );
  }, []);

  const startPatrolSession = useCallback(async () => {
    if (!supportedSite) {
      return;
    }

    setState({
      status: "starting",
      requestId: null,
      lockedDevice: null,
      message: "正在连接机器人巡检通道。",
      error: "",
    });

    try {
      await startQinghaiSitePatrol();

      setState((current) => ({
        ...current,
        status: "starting",
        message: "机器人已接收请求，正在进入自动巡检状态。",
        error: "",
      }));
    } catch (error) {
      clearPatrolSession();
      setState({
        status: "error",
        requestId: null,
        lockedDevice: null,
        message: "",
        error: buildStartErrorMessage(error),
      });
    }
  }, [supportedSite]);

  return {
    patrolState: state,
    startPatrol: startPatrolSession,
    dismissPatrolError: dismissError,
    clearPatrolState,
    isPatrolSupported: supportedSite,
    unsupportedPatrolMessage: getSupportedPatrolSiteMessage(siteId),
  };
}
