"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearPatrolSession, getPatrolSessionForSite, writePatrolSession } from "./patrol-session";
import { startPatrol, stopPatrol, subscribePatrolEvents } from "./client";
import type {
  PatrolLockedDevice,
  PersistedPatrolSession,
  RobotPatrolEvent,
} from "./types";

type RobotPatrolStatus =
  | "idle"
  | "starting"
  | "announcing"
  | "locked"
  | "cancelling"
  | "error";

type RobotPatrolState = {
  status: RobotPatrolStatus;
  requestId: string | null;
  lockedDevice: PatrolLockedDevice | null;
  message: string;
  error: string;
};

const INITIAL_STATE: RobotPatrolState = {
  status: "idle",
  requestId: null,
  lockedDevice: null,
  message: "",
  error: "",
};

const SSE_OPEN_TIMEOUT_MS = 4_000;
const TARGET_LOCK_TIMEOUT_MS = 15_000;

function buildDefaultMessage(status: RobotPatrolStatus): string {
  switch (status) {
    case "starting":
      return "正在连接机器人巡检通道。";
    case "announcing":
      return "机器人已进入自动巡检状态，正在广播并锁定最近的待处理设备。";
    case "cancelling":
      return "正在请求机器人结束当前巡检任务。";
    default:
      return "";
  }
}

function buildStartErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    if (error.message === "patrol_busy") {
      return "机器人已处于巡检任务中，请先结束当前巡检后再试。";
    }
    return error.message;
  }

  return "机器人巡检启动失败，请重试。";
}

export function useRobotPatrol(siteId: string) {
  const [state, setState] = useState<RobotPatrolState>(INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);
  const openTimeoutRef = useRef<number | null>(null);
  const targetLockTimeoutRef = useRef<number | null>(null);
  const lastSeenSequenceRef = useRef(0);
  const requestIdRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (targetLockTimeoutRef.current !== null) {
      window.clearTimeout(targetLockTimeoutRef.current);
      targetLockTimeoutRef.current = null;
    }
  }, []);

  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const resetRuntime = useCallback(() => {
    clearTimers();
    cleanupEventSource();
    lastSeenSequenceRef.current = 0;
    requestIdRef.current = null;
  }, [cleanupEventSource, clearTimers]);

  const clearPatrolState = useCallback(
    (requestId?: string | null) => {
      clearPatrolSession(requestId ?? undefined);
      resetRuntime();
      setState(INITIAL_STATE);
    },
    [resetRuntime],
  );

  const handleTerminalEvent = useCallback(
    (event: RobotPatrolEvent) => {
      clearPatrolSession(event.requestId);
      clearTimers();
      cleanupEventSource();
      lastSeenSequenceRef.current = event.sequence;
      requestIdRef.current = null;

      if (event.event === "patrol_failed") {
        setState({
          status: "error",
          requestId: null,
          lockedDevice: null,
          message: "",
          error: event.message || "机器人未能完成本次巡检初始化，请重试。",
        });
        return;
      }

      setState(INITIAL_STATE);
    },
    [cleanupEventSource, clearTimers],
  );

  const handlePatrolEvent = useCallback(
    (event: RobotPatrolEvent) => {
      if (event.sequence <= lastSeenSequenceRef.current) {
        return;
      }

      lastSeenSequenceRef.current = event.sequence;
      requestIdRef.current = event.requestId;

      if (
        event.event === "patrol_cancelled" ||
        event.event === "patrol_completed" ||
        event.event === "patrol_failed"
      ) {
        handleTerminalEvent(event);
        return;
      }

      if (event.event === "patrol_started") {
        if (targetLockTimeoutRef.current !== null) {
          window.clearTimeout(targetLockTimeoutRef.current);
        }
        targetLockTimeoutRef.current = window.setTimeout(() => {
          clearPatrolSession(event.requestId);
          cleanupEventSource();
          requestIdRef.current = null;
          setState({
            status: "error",
            requestId: null,
            lockedDevice: null,
            message: "",
            error: "机器人未在预期时间内锁定设备，请重新开始巡检。",
          });
        }, TARGET_LOCK_TIMEOUT_MS);

        setState((current) => ({
          ...current,
          status: "starting",
          requestId: event.requestId,
          message: event.message || "机器人已接受巡检请求，正在准备进入巡检状态。",
          error: "",
        }));
        return;
      }

      if (event.event === "patrol_announcing") {
        setState((current) => ({
          ...current,
          status: "announcing",
          requestId: event.requestId,
          message: event.message || buildDefaultMessage("announcing"),
          error: "",
        }));
        return;
      }

      if (event.event === "target_locked") {
        if (!event.device) {
          handleTerminalEvent({
            ...event,
            event: "patrol_failed",
            message: "机器人未返回锁定设备信息，请重新开始巡检。",
          });
          return;
        }

        if (targetLockTimeoutRef.current !== null) {
          window.clearTimeout(targetLockTimeoutRef.current);
          targetLockTimeoutRef.current = null;
        }

        const session: PersistedPatrolSession = {
          requestId: event.requestId,
          siteId,
          status: "locked",
          lockedDevice: event.device,
        };
        writePatrolSession(session);

        setState({
          status: "locked",
          requestId: event.requestId,
          lockedDevice: event.device,
          message:
            event.message || "当前已锁定问题设备，请通过任务卡发起扫码连接。",
          error: "",
        });
      }
    },
    [cleanupEventSource, handleTerminalEvent, siteId],
  );

  useEffect(() => {
    const persistedSession = getPatrolSessionForSite(siteId);
    if (!persistedSession) {
      return;
    }

    requestIdRef.current = persistedSession.requestId;
    setState({
      status: "locked",
      requestId: persistedSession.requestId,
      lockedDevice: persistedSession.lockedDevice,
      message: "当前已锁定问题设备，请通过任务卡发起扫码连接。",
      error: "",
    });
  }, [siteId]);

  useEffect(
    () => () => {
      clearTimers();
      cleanupEventSource();
    },
    [cleanupEventSource, clearTimers],
  );

  const dismissError = useCallback(() => {
    setState((current) =>
      current.lockedDevice
        ? {
            ...current,
            status: "locked",
            error: "",
          }
        : INITIAL_STATE,
    );
  }, []);

  const startPatrolSession = useCallback(async () => {
    if (state.status !== "idle" && state.status !== "error") {
      return;
    }

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    lastSeenSequenceRef.current = 0;

    setState({
      status: "starting",
      requestId,
      lockedDevice: null,
      message: buildDefaultMessage("starting"),
      error: "",
    });

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const fail = (error: Error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimers();
          cleanupEventSource();
          reject(error);
        };

        eventSourceRef.current = subscribePatrolEvents(
          requestId,
          handlePatrolEvent,
          () => {
            if (!settled) {
              fail(new Error("机器人事件通道建立失败，请重试。"));
            }
          },
          () => {
            if (settled) {
              return;
            }
            settled = true;
            if (openTimeoutRef.current !== null) {
              window.clearTimeout(openTimeoutRef.current);
              openTimeoutRef.current = null;
            }
            resolve();
          },
        );

        openTimeoutRef.current = window.setTimeout(() => {
          fail(new Error("机器人事件通道建立失败，请重试。"));
        }, SSE_OPEN_TIMEOUT_MS);
      });

      await startPatrol({
        requestId,
        siteId,
      });

      setState((current) => ({
        ...current,
        status: "starting",
        requestId,
        message: "机器人已接收请求，正在进入自动巡检状态。",
        error: "",
      }));
    } catch (error) {
      clearPatrolSession(requestId);
      resetRuntime();
      setState({
        status: "error",
        requestId: null,
        lockedDevice: null,
        message: "",
        error: buildStartErrorMessage(error),
      });
    }
  }, [cleanupEventSource, clearTimers, handlePatrolEvent, resetRuntime, siteId, state.status]);

  const stopPatrolSession = useCallback(async () => {
    const activeRequestId =
      state.requestId ?? requestIdRef.current ?? getPatrolSessionForSite(siteId)?.requestId;
    if (!activeRequestId) {
      clearPatrolState();
      return;
    }

    setState((current) => ({
      ...current,
      status: "cancelling",
      requestId: activeRequestId,
      message: buildDefaultMessage("cancelling"),
      error: "",
    }));

    try {
      const response = await stopPatrol({ requestId: activeRequestId });
      if (response.message === "patrol already stopped") {
        clearPatrolState(activeRequestId);
        return;
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        status: current.lockedDevice ? "locked" : "error",
        error:
          error instanceof Error && error.message
            ? error.message
            : "机器人未确认结束巡检，请重试。",
      }));
    }
  }, [clearPatrolState, siteId, state.requestId]);

  return {
    patrolState: state,
    startPatrol: startPatrolSession,
    stopPatrol: stopPatrolSession,
    dismissPatrolError: dismissError,
    clearPatrolState,
  };
}
