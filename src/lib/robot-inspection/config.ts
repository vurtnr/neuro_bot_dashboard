declare global {
  interface Window {
    __ROBOT_DASHBOARD_RUNTIME_CONFIG__?: Record<string, string | undefined>;
  }
}

const BUILD_TIME_PUBLIC_CONFIG = {
  NEXT_PUBLIC_ROBOT_BASE_URL: process.env.NEXT_PUBLIC_ROBOT_BASE_URL ?? "",
  NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL:
    process.env.NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL ?? "",
  NEXT_PUBLIC_PLANT_CREATED_WS_URL:
    process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL ?? "",
  NEXT_PUBLIC_TIANDITU_KEY: process.env.NEXT_PUBLIC_TIANDITU_KEY ?? "",
} as const;

function readPublicConfig(
  key: keyof typeof BUILD_TIME_PUBLIC_CONFIG,
): string {
  if (typeof window !== "undefined") {
    const runtimeValue = window.__ROBOT_DASHBOARD_RUNTIME_CONFIG__?.[key]?.trim();
    if (runtimeValue) {
      return runtimeValue;
    }
  }

  return BUILD_TIME_PUBLIC_CONFIG[key].trim();
}

export function getRobotBaseUrl(): string {
  return readPublicConfig("NEXT_PUBLIC_ROBOT_BASE_URL").replace(/\/+$/, "");
}

export function hasRobotBaseUrl(): boolean {
  return getRobotBaseUrl().length > 0;
}

export function getPlantCreatedWebSocketUrl(): string {
  const explicit = readPublicConfig("NEXT_PUBLIC_PLANT_CREATED_WS_URL");
  if (!explicit) {
    return "";
  }

  return explicit.startsWith("ws://") || explicit.startsWith("wss://")
    ? explicit
    : "";
}

export function getRobotVideoBaseUrl(): string {
  const explicit = readPublicConfig("NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL").replace(
    /\/+$/,
    "",
  );
  if (explicit) {
    return explicit;
  }

  const robotBaseUrl = getRobotBaseUrl();
  if (!robotBaseUrl) {
    return "";
  }

  try {
    const url = new URL(robotBaseUrl);
    url.port = "8080";
    return url.origin;
  } catch {
    return "";
  }
}

export function getRobotCameraStreamUrl(topic = "/camera_driver/image_raw"): string {
  const videoBaseUrl = getRobotVideoBaseUrl();
  if (!videoBaseUrl) {
    return "";
  }

  return `${videoBaseUrl}/stream?topic=${topic}`;
}

export function getRobotCameraEmbeddedViewerPath(
  topic = "/camera_driver/image_raw",
): string {
  return `/robot-camera-viewer?topic=${topic}`;
}

export function getRobotCameraViewerUrl(topic = "/camera_driver/image_raw"): string {
  const videoBaseUrl = getRobotVideoBaseUrl();
  if (!videoBaseUrl) {
    return "";
  }

  return `${videoBaseUrl}/stream_viewer?topic=${topic}`;
}
