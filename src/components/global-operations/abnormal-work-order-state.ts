import type { RobotInspectionEvent } from "../../lib/robot-inspection/types";
import type { AbnormalWorkOrderStatus } from "./abnormal-work-order-card";

export type AbnormalWorkOrderToast = {
  tone: "info" | "critical";
  message: string;
};

export type AbnormalWorkOrderUiState = {
  status: AbnormalWorkOrderStatus;
  toast: AbnormalWorkOrderToast | null;
};

export function reduceAbnormalWorkOrderState(
  state: AbnormalWorkOrderUiState,
  event: RobotInspectionEvent,
): AbnormalWorkOrderUiState {
  switch (event.event) {
    case "support_escalation_sent":
      return {
        status: "submitted",
        toast: null,
      };
    case "support_escalation_cancelled":
      return {
        status: "idle",
        toast: {
          tone: "info",
          message: event.message ?? "已取消发送异常状态工单。",
        },
      };
    default:
      return state;
  }
}
