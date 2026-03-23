import { getRobotCameraStreamUrl } from "@/lib/robot-inspection/config";

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
  const cameraStreamUrl = getRobotCameraStreamUrl(resolvedTopic);

  return (
    <main className="h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="relative h-full w-full overflow-hidden">
        {cameraStreamUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cameraStreamUrl}
            alt={`机器人实时画面 ${resolvedTopic}`}
            className="block h-full w-full bg-slate-950 object-cover"
            loading="eager"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-medium text-slate-300">
            未配置机器人实时视频流地址，请检查 `NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL`
            或 `NEXT_PUBLIC_ROBOT_BASE_URL`。
          </div>
        )}
      </div>
    </main>
  );
}
