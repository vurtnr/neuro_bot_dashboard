export type RobotInspectionEventType =
  | "accepted"
  | "waiting_for_qr"
  | "qr_detected"
  | "ble_connecting"
  | "querying_device"
  | "success"
  | "failed"
  | "patrol_started"
  | "patrol_anomaly_detected"
  | "patrol_completed"
  | "patrol_failed";

export type RobotInspectionEvent = {
  requestId: string;
  event: RobotInspectionEventType;
  success?: boolean;
  reason?: string;
  message?: string;
  siteId?: string;
  siteName?: string;
  nodeId?: string;
  nodeLabel?: string;
  hasDeviceAngles?: boolean;
  actualAngle?: number;
  targetAngle?: number;
};

export type RobotPatrolEventType =
  | "patrol_started"
  | "patrol_announcing"
  | "target_locked"
  | "patrol_cancelled"
  | "patrol_completed"
  | "patrol_failed";

export type PatrolLockedDevice = {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  deviceCategory: string;
};

export type RobotPatrolEvent = {
  requestId: string;
  sequence: number;
  event: RobotPatrolEventType;
  success?: boolean;
  reason?: string;
  message?: string;
  device?: PatrolLockedDevice;
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

export type StartPatrolPayload = {
  requestId: string;
  siteId: string;
};

export type StartPatrolResponse = {
  accepted: boolean;
  message: string;
  requestId?: string;
  activeRequestId?: string;
};

export type StopPatrolPayload = {
  requestId: string;
};

export type StopPatrolResponse = {
  success: boolean;
  message: string;
  requestId?: string;
};

export type PatrolSessionStatus = "locked";

export type PersistedPatrolSession = {
  requestId: string;
  siteId: string;
  status: PatrolSessionStatus;
  lockedDevice: PatrolLockedDevice;
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

export type ManualAngleDirection = "west" | "east";

export type ManualAngleControlPayload = {
  requestId: string;
  siteId: string;
  nodeId: string;
  nodeLabel: string;
  direction: ManualAngleDirection;
  deltaAngle?: number;
};

export type ManualAngleControlResponse = {
  success: boolean;
  message: string;
  errorCode?: string;
  actualAngleUsed?: number;
  verifiedActualAngle?: number;
  verifiedChanged?: boolean;
  targetAngle?: number;
  deltaAngleUsed?: number;
};
