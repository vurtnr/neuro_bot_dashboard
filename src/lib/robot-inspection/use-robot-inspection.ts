"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startInspection,
  subscribeInspectionEvents,
} from "./client";
import type {
  RobotInspectionEvent,
  StartInspectionPayload,
} from "./types";

type InspectionDialogState =
  | {
      open: false;
      loading: false;
      message: string;
      error: string;
    }
  | {
      open: true;
      loading: boolean;
      message: string;
      error: string;
    };

const INITIAL_STATE: InspectionDialogState = {
  open: false,
  loading: false,
  message: "",
  error: "",
};

const STAGE_MESSAGES: Partial<Record<RobotInspectionEvent["event"], string>> = {
  accepted: "机器人已接受巡检任务，正在准备。",
  waiting_for_qr: "请等待机器人进行设备识别。",
  qr_detected: "已识别二维码，正在锁定设备。",
  ble_connecting: "正在连接设备蓝牙。",
  querying_device: "正在查询设备状态，请稍候。",
};

function buildFailureMessage(event?: RobotInspectionEvent, fallback?: string): string {
  if (event?.reason === "scan_timeout") {
    return "二维码识别失败，请重试。";
  }
  if (event?.reason === "robot_busy") {
    return "机器人当前忙碌，请稍后重试。";
  }
  return event?.message || fallback || "识别失败，请重试。";
}

export function useRobotInspection() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [dialogState, setDialogState] =
    useState<InspectionDialogState>(INITIAL_STATE);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const closeDialog = useCallback(() => {
    cleanup();
    setDialogState(INITIAL_STATE);
  }, [cleanup]);

  const failInspection = useCallback(
    (message: string) => {
      cleanup();
      setDialogState({
        open: true,
        loading: false,
        message: "",
        error: message,
      });
    },
    [cleanup],
  );

  const beginInspection = useCallback(
    async (
      payload: Omit<StartInspectionPayload, "requestId">,
      onSuccess: () => void,
    ) => {
      cleanup();
      setDialogState({
        open: true,
        loading: true,
        message: "请等待机器人进行设备识别。",
        error: "",
      });

      const requestId = crypto.randomUUID();

      try {
        eventSourceRef.current = subscribeInspectionEvents(
          requestId,
          (event) => {
            if (event.event === "success") {
              cleanup();
              setDialogState(INITIAL_STATE);
              onSuccess();
              return;
            }

            if (event.event === "failed") {
              failInspection(buildFailureMessage(event));
              return;
            }

            setDialogState((current) => ({
              ...current,
              open: true,
              loading: true,
              message: STAGE_MESSAGES[event.event] || current.message,
              error: "",
            }));
          },
          () => {
            // Let the global timeout handle transient EventSource reconnects.
          },
        );

        timeoutRef.current = window.setTimeout(() => {
          failInspection("机器人响应超时，请重试。");
        }, 45_000);

        await startInspection({
          requestId,
          ...payload,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? buildFailureMessage(undefined, error.message)
            : "识别失败，请重试。";
        failInspection(message);
      }
    },
    [cleanup, failInspection],
  );

  return {
    beginInspection,
    closeDialog,
    dialogState,
  };
}
