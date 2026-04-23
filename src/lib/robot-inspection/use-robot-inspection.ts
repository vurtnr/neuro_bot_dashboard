"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { startInspection, subscribeInspectionEvents } from "./client";
import type {
  RobotInspectionEvent,
  RobotInspectionEventType,
  StartInspectionPayload,
} from "./types";

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

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

type DialogInspectionEventType =
  | "accepted"
  | "permission_prompting"
  | "permission_listening"
  | "permission_retrying"
  | "permission_denied"
  | "permission_unresolved"
  | "waiting_for_qr"
  | "qr_detected"
  | "ble_connecting"
  | "querying_device"
  | "failed";

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

function isDialogEventType(
  eventType: RobotInspectionEventType,
): eventType is DialogInspectionEventType {
  switch (eventType) {
    case "accepted":
    case "permission_prompting":
    case "permission_listening":
    case "permission_retrying":
    case "permission_denied":
    case "permission_unresolved":
    case "waiting_for_qr":
    case "qr_detected":
    case "ble_connecting":
    case "querying_device":
    case "failed":
      return true;
    default:
      return false;
  }
}

function isDialogEvent(
  event: RobotInspectionEvent,
): event is RobotInspectionEvent & { event: DialogInspectionEventType } {
  return isDialogEventType(event.event);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled inspection dialog event: ${value}`);
}

function buildDialogCopy(event: RobotInspectionEvent & { event: DialogInspectionEventType }): {
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
    case "failed":
      return {
        phase: "failed",
        message: buildFailureMessage(event),
        detail: "你可以关闭弹框后重新点击带工单角标的设备节点。",
      };
    default:
      return assertNever(event.event);
  }
}

function isAllowedTransition(
  current: InspectionDialogState,
  nextEvent: DialogInspectionEventType,
) {
  if (!current.open) {
    return nextEvent === "accepted" || nextEvent === "permission_prompting";
  }

  switch (current.phase) {
    case "requesting_permission":
      return (
        nextEvent === "accepted" ||
        nextEvent === "permission_prompting" ||
        nextEvent === "permission_listening" ||
        nextEvent === "permission_retrying" ||
        nextEvent === "permission_denied" ||
        nextEvent === "permission_unresolved" ||
        nextEvent === "waiting_for_qr" ||
        nextEvent === "failed"
      );
    case "awaiting_permission_response":
      return (
        nextEvent === "permission_listening" ||
        nextEvent === "permission_retrying" ||
        nextEvent === "permission_denied" ||
        nextEvent === "permission_unresolved" ||
        nextEvent === "waiting_for_qr" ||
        nextEvent === "failed"
      );
    case "retrying_permission":
      return (
        nextEvent === "permission_prompting" ||
        nextEvent === "permission_listening" ||
        nextEvent === "permission_denied" ||
        nextEvent === "permission_unresolved" ||
        nextEvent === "waiting_for_qr" ||
        nextEvent === "failed"
      );
    case "permission_denied":
    case "permission_unresolved":
      return nextEvent === "failed";
    case "waiting_for_qr":
      return (
        nextEvent === "waiting_for_qr" ||
        nextEvent === "qr_detected" ||
        nextEvent === "failed"
      );
    case "qr_detected":
      return (
        nextEvent === "qr_detected" ||
        nextEvent === "ble_connecting" ||
        nextEvent === "failed"
      );
    case "ble_connecting":
      return (
        nextEvent === "ble_connecting" ||
        nextEvent === "querying_device" ||
        nextEvent === "failed"
      );
    case "querying_device":
    case "failed":
      return nextEvent === "failed";
  }
}

export function reduceInspectionDialogState(
  current: InspectionDialogState,
  event: RobotInspectionEvent,
): InspectionDialogState {
  if (event.event === "success") {
    return INITIAL_STATE;
  }

  if (!isDialogEvent(event)) {
    return current;
  }

  if (!isAllowedTransition(current, event.event)) {
    return current;
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
        requestId: requestId ?? createRequestId(),
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

      const requestId = createRequestId();

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
