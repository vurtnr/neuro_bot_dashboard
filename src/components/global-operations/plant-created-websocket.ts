export type PlantCreatedConnectionState =
  | "disabled"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type PlantCreatedConnectionTone =
  | "muted"
  | "info"
  | "success"
  | "warning"
  | "critical";

export function getPlantCreatedConnectionLabel(
  state: PlantCreatedConnectionState,
) {
  switch (state) {
    case "disabled":
      return "Plant Feed 未配置";
    case "connecting":
      return "Plant Feed 连接中";
    case "connected":
      return "Plant Feed 已连接";
    case "reconnecting":
      return "Plant Feed 重连中";
    case "error":
      return "Plant Feed 异常";
  }
}

export function getPlantCreatedConnectionTone(
  state: PlantCreatedConnectionState,
): PlantCreatedConnectionTone {
  switch (state) {
    case "disabled":
      return "muted";
    case "connecting":
      return "info";
    case "connected":
      return "success";
    case "reconnecting":
      return "warning";
    case "error":
      return "critical";
  }
}

export function getPlantCreatedRetryDelay(attempt: number) {
  const sanitizedAttempt = Math.max(0, attempt);
  return Math.min(1000 * 2 ** sanitizedAttempt, 10000);
}
