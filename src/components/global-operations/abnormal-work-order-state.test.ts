import assert from "node:assert/strict";
import test from "node:test";

import {
  reduceAbnormalWorkOrderState,
  type AbnormalWorkOrderUiState,
} from "./abnormal-work-order-state";
import type { RobotInspectionEvent } from "../../lib/robot-inspection/types";

test("support escalation sent marks card submitted and clears toast", () => {
  const state: AbnormalWorkOrderUiState = {
    status: "sent",
    toast: {
      tone: "info",
      message: "已通知机器人处理异常状态工单，请根据机器人语音确认是否发送给天合光能运维部门。",
    },
  };

  const next = reduceAbnormalWorkOrderState(state, {
    requestId: "support-1",
    event: "support_escalation_sent",
    success: true,
  } satisfies RobotInspectionEvent);

  assert.equal(next.status, "submitted");
  assert.equal(next.toast, null);
});
