import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_STATE,
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
    requestId: "req-2",
    event: "permission_prompting",
  } satisfies RobotInspectionEvent);
  assert.equal(prompting.phase, "requesting_permission");
  assert.equal(prompting.message, "机器人正在请求语音授权。");
  assert.equal(prompting.detail, "机器人会先询问是否可以获取该设备数据。");
  assert.equal(prompting.requestId, "req-2");

  const listening = reduceInspectionDialogState(prompting, {
    requestId: "req-3",
    event: "permission_listening",
  } satisfies RobotInspectionEvent);
  assert.equal(listening.phase, "awaiting_permission_response");
  assert.equal(listening.message, "正在等待用户语音确认。");
  assert.equal(listening.detail, "请用户直接回答是否可以获取该设备数据。");
  assert.equal(listening.requestId, "req-3");

  const retrying = reduceInspectionDialogState(listening, {
    requestId: "req-4",
    event: "permission_retrying",
  } satisfies RobotInspectionEvent);
  assert.equal(retrying.phase, "retrying_permission");
  assert.equal(retrying.message, "机器人正在再次请求语音授权。");
  assert.equal(retrying.detail, "首次未拿到明确同意，机器人会再询问一次。");
  assert.equal(retrying.requestId, "req-4");

  const qrWaiting = reduceInspectionDialogState(retrying, {
    requestId: "req-5",
    event: "waiting_for_qr",
  } satisfies RobotInspectionEvent);
  assert.equal(qrWaiting.phase, "waiting_for_qr");
  assert.equal(qrWaiting.message, "请等待机器人进行设备识别。");
  assert.equal(qrWaiting.detail, "已获得语音授权，正在进入二维码扫描流程。");
  assert.equal(qrWaiting.requestId, "req-5");
});

test("keeps refusal distinct from unresolved permission", () => {
  const denied = reduceInspectionDialogState(baseState, {
    requestId: "req-1",
    event: "permission_denied",
    reason: "user_refused",
  } satisfies RobotInspectionEvent);
  assert.equal(denied.phase, "permission_denied");
  assert.equal(denied.message, "用户已明确拒绝本次设备数据获取请求。");
  assert.equal(denied.detail, "你可以结束本次复核，或重新请求机器人进行语音确认。");

  const unresolved = reduceInspectionDialogState(baseState, {
    requestId: "req-1",
    event: "permission_unresolved",
    reason: "permission_timeout",
  } satisfies RobotInspectionEvent);
  assert.equal(unresolved.phase, "permission_unresolved");
  assert.equal(unresolved.message, "本次未获得明确语音授权。");
  assert.equal(unresolved.detail, "系统已结束本次复核尝试，请返回异常待复核状态后重新发起。");
});

test("accepted opens the explicit permission-requesting state", () => {
  const accepted = reduceInspectionDialogState(INITIAL_STATE, {
    requestId: "req-accepted",
    event: "accepted",
  } satisfies RobotInspectionEvent);

  assert.deepEqual(accepted, {
    open: true,
    phase: "requesting_permission",
    message: "机器人正在请求语音授权。",
    detail: "机器人会先询问是否可以获取该设备数据。",
    requestId: "req-accepted",
  });
});

test("success returns the reducer to INITIAL_STATE", () => {
  const resolved = reduceInspectionDialogState(baseState, {
    requestId: "req-success",
    event: "success",
  } satisfies RobotInspectionEvent);

  assert.deepEqual(resolved, INITIAL_STATE);
});

test("failed uses known failure copy and propagates requestId", () => {
  const failed = reduceInspectionDialogState(baseState, {
    requestId: "req-failed",
    event: "failed",
    reason: "robot_busy",
  } satisfies RobotInspectionEvent);

  assert.deepEqual(failed, {
    open: true,
    phase: "failed",
    message: "机器人当前忙碌，请稍后重试。",
    detail: "你可以关闭弹框后重新点击带工单角标的设备节点。",
    requestId: "req-failed",
  });
});

test("ignores patrol events that are not part of the inspection dialog state machine", () => {
  const ignored = reduceInspectionDialogState(baseState, {
    requestId: "req-patrol",
    event: "patrol_started",
  } satisfies RobotInspectionEvent);

  assert.deepEqual(ignored, baseState);
});

test("ignores impossible scan transitions that skip required earlier phases", () => {
  const skipped = reduceInspectionDialogState(baseState, {
    requestId: "req-skip",
    event: "ble_connecting",
  } satisfies RobotInspectionEvent);

  assert.deepEqual(skipped, baseState);
});

test("rejects scan events while idle", () => {
  const idleResult = reduceInspectionDialogState(INITIAL_STATE, {
    requestId: "req-idle",
    event: "waiting_for_qr",
  } satisfies RobotInspectionEvent);

  assert.deepEqual(idleResult, INITIAL_STATE);
});

test("rejects further dialog transitions after permission_denied", () => {
  const deniedState = reduceInspectionDialogState(baseState, {
    requestId: "req-denied",
    event: "permission_denied",
    reason: "user_refused",
  } satisfies RobotInspectionEvent);

  const rejected = reduceInspectionDialogState(deniedState, {
    requestId: "req-after-denied",
    event: "waiting_for_qr",
  } satisfies RobotInspectionEvent);

  assert.equal(rejected.phase, "permission_denied");
  assert.equal(rejected.message, "用户已明确拒绝本次设备数据获取请求。");
  assert.equal(rejected.detail, "你可以结束本次复核，或重新请求机器人进行语音确认。");
  assert.equal(rejected.requestId, "req-denied");
});

test("rejects further dialog transitions after permission_unresolved", () => {
  const unresolvedState = reduceInspectionDialogState(baseState, {
    requestId: "req-unresolved",
    event: "permission_unresolved",
    reason: "permission_timeout",
  } satisfies RobotInspectionEvent);

  const rejected = reduceInspectionDialogState(unresolvedState, {
    requestId: "req-after-unresolved",
    event: "waiting_for_qr",
  } satisfies RobotInspectionEvent);

  assert.equal(rejected.phase, "permission_unresolved");
  assert.equal(rejected.message, "本次未获得明确语音授权。");
  assert.equal(rejected.detail, "系统已结束本次复核尝试，请返回异常待复核状态后重新发起。");
  assert.equal(rejected.requestId, "req-unresolved");
});

test("rejects invalid later-phase jumps inside the scan flow", () => {
  const waitingForQr = reduceInspectionDialogState(baseState, {
    requestId: "req-qr",
    event: "waiting_for_qr",
  } satisfies RobotInspectionEvent);

  const jumped = reduceInspectionDialogState(waitingForQr, {
    requestId: "req-query",
    event: "querying_device",
  } satisfies RobotInspectionEvent);

  assert.equal(jumped.phase, "waiting_for_qr");
  assert.equal(jumped.message, "请等待机器人进行设备识别。");
  assert.equal(jumped.detail, "已获得语音授权，正在进入二维码扫描流程。");
  assert.equal(jumped.requestId, "req-qr");
});
