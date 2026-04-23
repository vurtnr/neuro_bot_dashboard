"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createUuid } from "../uuid";
import { startInspection, subscribeInspectionEvents } from "./client";
import type {
  RobotInspectionEvent,
  StartInspectionPayload,
} from "./types";

type InspectionDialogPhase =
  | "requesting_permission"
  | "awaiting_permission_response"
  | "retrying_permission"
  | "permission_denied"
  | "permission_unresolved"
  | "waiting_for_qr"
  | "qr_detected"
  | "ble_connecting"
  | "querying_device"
  | "failed";

export type InspectionDialogState =
  | { open: false; phase: "idle"; message: ""; detail: ""; requestId: null }
  | {
      open: true;
      phase: InspectionDialogPhase;
      message: string;
      detail: string;
      requestId: string;
    };

export const INITIAL_STATE: InspectionDialogState = {
  open: false,
  phase: "idle",
  message: "",
  detail: "",
  requestId: null,
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

function buildDialogCopy(event: RobotInspectionEvent): {
  phase: InspectionDialogPhase;
  message: string;
  detail: string;
} {
  switch (event.event) {
    case "accepted":
    case "permission_prompting":
      return {
        phase: "requesting_permission",
        message: "机器人正在请求语音授权。",
        detail: "机器人会先询问是否可以获取该设备数据。",
      };
    case "permission_listening":
      return {
        phase: "awaiting_permission_response",
        message: "正在等待用户语音确认。",
        detail: "请用户直接回答是否可以获取该设备数据。",
      };
    case "permission_retrying":
      return {
        phase: "retrying_permission",
        message: "机器人正在再次请求语音授权。",
        detail: "首次未拿到明确同意，机器人会再询问一次。",
      };
    case "permission_denied":
      return {
        phase: "permission_denied",
        message: "用户已明确拒绝本次设备数据获取请求。",
        detail: "你可以结束本次复核，或重新请求机器人进行语音确认。",
      };
    case "permission_unresolved":
      return {
        phase: "permission_unresolved",
        message: "本次未获得明确语音授权。",
        detail: "系统已结束本次复核尝试，请返回异常待复核状态后重新发起。",
      };
    case "waiting_for_qr":
      return {
        phase: "waiting_for_qr",
        message: "请等待机器人进行设备识别。",
        detail: "已获得语音授权，正在进入二维码扫描流程。",
      };
    case "qr_detected":
      return {
        phase: "qr_detected",
        message: "已识别二维码，正在锁定设备。",
        detail: "请保持机器人视野稳定。",
      };
    case "ble_connecting":
      return {
        phase: "ble_connecting",
        message: "正在连接设备蓝牙。",
        detail: "请保持当前页面，等待蓝牙连接完成。",
      };
    case "querying_device":
      return {
        phase: "querying_device",
        message: "正在查询设备状态，请稍候。",
        detail: "机器人正在读取异常设备数据。",
      };
    default:
      return {
        phase: "failed",
        message: buildFailureMessage(event),
        detail: "你可以关闭弹框后重新点击带工单角标的设备节点。",
      };
  }
}

export function reduceInspectionDialogState(
  current: InspectionDialogState,
  event: RobotInspectionEvent,
): InspectionDialogState {
  if (event.event === "success") {
    return INITIAL_STATE;
  }

  if (event.event === "failed") {
    const copy = buildDialogCopy(event);
    return {
      open: true,
      phase: copy.phase,
      message: copy.message,
      detail: copy.detail,
      requestId: event.requestId,
    };
  }

  const copy = buildDialogCopy(event);
  return {
    open: true,
    phase: copy.phase,
    message: copy.message,
    detail: copy.detail,
    requestId: event.requestId,
  };
}

export function useRobotInspection() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const lastRequestRef = useRef<{
    payload: Omit<StartInspectionPayload, "requestId">;
    onSuccess: (event: RobotInspectionEvent) => void;
  } | null>(null);
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
    (message: string, requestId?: string) => {
      cleanup();
      setDialogState({
        open: true,
        phase: "failed",
        message,
        detail: "你可以关闭弹框后重新点击带工单角标的设备节点。",
        requestId: requestId ?? createUuid(),
      });
    },
    [cleanup],
  );

  const beginInspection = useCallback(
    async (
      payload: Omit<StartInspectionPayload, "requestId">,
      onSuccess: (event: RobotInspectionEvent) => void,
    ) => {
      lastRequestRef.current = { payload, onSuccess };
      cleanup();

      const requestId = createUuid();

      setDialogState({
        open: true,
        phase: "requesting_permission",
        message: "机器人正在请求语音授权。",
        detail: "请等待机器人语音询问用户是否可以获取该设备数据。",
        requestId,
      });

      try {
        eventSourceRef.current = subscribeInspectionEvents(
          requestId,
          (event) => {
            if (event.event === "success") {
              cleanup();
              setDialogState(INITIAL_STATE);
              onSuccess(event);
              return;
            }

            setDialogState((current) =>
              reduceInspectionDialogState(current, event),
            );
          },
          () => {
            // Let the global timeout handle transient EventSource reconnects.
          },
        );

        timeoutRef.current = window.setTimeout(() => {
          failInspection("机器人响应超时，请重试。", requestId);
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
        failInspection(message, requestId);
      }
    },
    [cleanup, failInspection],
  );

  const retryPermission = useCallback(async () => {
    const lastRequest = lastRequestRef.current;
    if (!lastRequest) {
      return;
    }

    await beginInspection(lastRequest.payload, lastRequest.onSuccess);
  }, [beginInspection]);

  return {
    beginInspection,
    closeDialog,
    retryPermission,
    dialogState,
  };
}
