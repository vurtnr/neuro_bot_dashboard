import assert from "node:assert/strict";
import test from "node:test";

import {
  reduceInspectionDialogState,
  type InspectionDialogState,
} from "./use-robot-inspection";
import type { RobotInspectionEvent } from "./types";

const baseState: InspectionDialogState = {
  open: true,
  phase: "requesting_permission",
  message: "机器人正在请求语音授权。",
  detail: "请等待机器人语音询问用户是否可以获取该设备数据。",
  requestId: "req-1",
};

test("transitions from permission phases into scan phases only after consent", () => {
  const prompting = reduceInspectionDialogState(baseState, {
    requestId: "req-1",
    event: "permission_prompting",
  } satisfies RobotInspectionEvent);
  assert.equal(prompting.phase, "requesting_permission");

  const listening = reduceInspectionDialogState(prompting, {
    requestId: "req-1",
    event: "permission_listening",
  } satisfies RobotInspectionEvent);
  assert.equal(listening.phase, "awaiting_permission_response");

  const retrying = reduceInspectionDialogState(listening, {
    requestId: "req-1",
    event: "permission_retrying",
  } satisfies RobotInspectionEvent);
  assert.equal(retrying.phase, "retrying_permission");

  const qrWaiting = reduceInspectionDialogState(retrying, {
    requestId: "req-1",
    event: "waiting_for_qr",
  } satisfies RobotInspectionEvent);
  assert.equal(qrWaiting.phase, "waiting_for_qr");
});

test("keeps refusal distinct from unresolved permission", () => {
  const denied = reduceInspectionDialogState(baseState, {
    requestId: "req-1",
    event: "permission_denied",
    reason: "user_refused",
  } satisfies RobotInspectionEvent);
  assert.equal(denied.phase, "permission_denied");

  const unresolved = reduceInspectionDialogState(baseState, {
    requestId: "req-1",
    event: "permission_unresolved",
    reason: "permission_timeout",
  } satisfies RobotInspectionEvent);
  assert.equal(unresolved.phase, "permission_unresolved");
});
