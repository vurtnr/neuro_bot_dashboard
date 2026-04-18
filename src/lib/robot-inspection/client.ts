import { getRobotBaseUrl } from "./config";
import type {
  ManualAngleControlPayload,
  ManualAngleControlResponse,
  RobotInspectionEvent,
  RobotPatrolEvent,
  StartInspectionPayload,
  StartInspectionResponse,
  StartPatrolPayload,
  StartPatrolResponse,
  StopPatrolPayload,
  StopPatrolResponse,
  WorkOrderCapturePayload,
  WorkOrderCaptureResponse,
  WorkOrderCompletionPayload,
  WorkOrderCompletionResponse,
} from "./types";

function createRobotUrl(path: string): string {
  const baseUrl = getRobotBaseUrl();
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_ROBOT_BASE_URL is not configured");
  }

  return `${baseUrl}${path}`;
}

export async function startInspection(
  payload: StartInspectionPayload,
): Promise<StartInspectionResponse> {
  const response = await fetch(createRobotUrl("/inspection-sessions/start"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StartInspectionResponse;
  if (!response.ok) {
    throw new Error(data.message || "failed_to_start_inspection");
  }

  return data;
}

export function subscribeInspectionEvents(
  requestId: string,
  onEvent: (event: RobotInspectionEvent) => void,
  onError: () => void,
): EventSource {
  const source = new EventSource(
    createRobotUrl(`/inspection-sessions/${requestId}/events`),
  );

  source.onmessage = (message) => {
    const payload = JSON.parse(message.data) as RobotInspectionEvent;
    onEvent(payload);
  };

  source.onerror = () => {
    onError();
  };

  return source;
}

export function subscribeGlobalInspectionEvents(
  onEvent: (event: RobotInspectionEvent) => void,
  onError: () => void,
): EventSource {
  const source = new EventSource(createRobotUrl("/inspection-events"));

  source.onmessage = (message) => {
    const payload = JSON.parse(message.data) as RobotInspectionEvent;
    onEvent(payload);
  };

  source.onerror = () => {
    onError();
  };

  return source;
}

export async function startPatrol(
  payload: StartPatrolPayload,
): Promise<StartPatrolResponse> {
  const response = await fetch(createRobotUrl("/patrol-sessions/start"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StartPatrolResponse;
  if (!response.ok) {
    throw new Error(data.message || "failed_to_start_patrol");
  }

  return data;
}

export async function stopPatrol(
  payload: StopPatrolPayload,
): Promise<StopPatrolResponse> {
  const response = await fetch(createRobotUrl("/patrol-sessions/stop"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as StopPatrolResponse;
  if (!response.ok) {
    throw new Error(data.message || "failed_to_stop_patrol");
  }

  return data;
}

export function subscribePatrolEvents(
  requestId: string,
  onEvent: (event: RobotPatrolEvent) => void,
  onError: () => void,
  onOpen?: () => void,
): EventSource {
  const source = new EventSource(createRobotUrl(`/patrol-sessions/${requestId}/events`));

  source.onopen = () => {
    onOpen?.();
  };

  source.onmessage = (message) => {
    const payload = JSON.parse(message.data) as RobotPatrolEvent;
    onEvent(payload);
  };

  source.onerror = () => {
    onError();
  };

  return source;
}

export async function captureWorkOrderSnapshot(
  payload: WorkOrderCapturePayload,
): Promise<WorkOrderCaptureResponse> {
  const response = await fetch(createRobotUrl("/work-order-captures"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as WorkOrderCaptureResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.message || "failed_to_capture_snapshot");
  }

  return data;
}

export async function completeWorkOrder(
  payload: WorkOrderCompletionPayload,
): Promise<WorkOrderCompletionResponse> {
  const response = await fetch(createRobotUrl("/work-order-completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as WorkOrderCompletionResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.message || "failed_to_complete_work_order");
  }

  return data;
}

export async function manualAngleControl(
  payload: ManualAngleControlPayload,
): Promise<ManualAngleControlResponse> {
  const response = await fetch(createRobotUrl("/manual-angle-controls"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as ManualAngleControlResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.message || "failed_to_control_manual_angle");
  }

  return data;
}
