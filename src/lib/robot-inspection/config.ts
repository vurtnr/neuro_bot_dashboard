export function getRobotBaseUrl(): string {
  return process.env.NEXT_PUBLIC_ROBOT_BASE_URL?.replace(/\/+$/, "") ?? "";
}

export function getRobotVideoBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL?.replace(/\/+$/, "");
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
