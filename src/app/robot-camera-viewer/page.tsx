import { RobotCameraViewerClient } from "./robot-camera-viewer-client";

interface RobotCameraViewerPageProps {
  searchParams: Promise<{
    topic?: string | string[];
  }>;
}

function resolveTopic(topic?: string | string[]): string {
  if (Array.isArray(topic)) {
    return topic[0] || "/camera_driver/image_raw";
  }

  return topic || "/camera_driver/image_raw";
}

export const dynamic = "force-dynamic";

export default async function RobotCameraViewerPage({
  searchParams,
}: RobotCameraViewerPageProps) {
  const { topic } = await searchParams;
  const resolvedTopic = resolveTopic(topic);

  return <RobotCameraViewerClient topic={resolvedTopic} />;
}
