export type RobotInspectionEventType =
  | "accepted"
  | "waiting_for_qr"
  | "qr_detected"
  | "ble_connecting"
  | "querying_device"
  | "success"
  | "failed";

export type RobotInspectionEvent = {
  requestId: string;
  event: RobotInspectionEventType;
  success?: boolean;
  reason?: string;
  message?: string;
};

export type StartInspectionPayload = {
  requestId: string;
  siteId: string;
  nodeId: string;
  nodeLabel: string;
};

export type StartInspectionResponse = {
  accepted: boolean;
  message: string;
  requestId?: string;
};

export type WorkOrderCapturePayload = {
  requestId: string;
  siteId: string;
  nodeId: string;
  nodeLabel: string;
};

export type WorkOrderCaptureResponse = {
  success: boolean;
  message: string;
  imageBase64?: string;
  mimeType?: string;
  capturedAt?: string;
  width?: number;
  height?: number;
};

export type WorkOrderCompletionPayload = {
  requestId: string;
  siteId: string;
  nodeId: string;
  nodeLabel: string;
};

export type WorkOrderCompletionResponse = {
  success: boolean;
  message: string;
};
