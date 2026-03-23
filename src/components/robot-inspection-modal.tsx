"use client";

type RobotInspectionModalProps = {
  open: boolean;
  loading: boolean;
  message: string;
  error: string;
  onClose: () => void;
};

function Spinner() {
  return (
    <span className="inline-flex h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
  );
}

export default function RobotInspectionModal({
  open,
  loading,
  message,
  error,
  onClose,
}: RobotInspectionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
          机器人巡检
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          {loading ? "等待设备识别" : "识别失败"}
        </h2>
        <div className="mt-5 flex items-start gap-4">
          {loading ? (
            <div className="mt-1 shrink-0">
              <Spinner />
            </div>
          ) : (
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-lg text-rose-600">
              !
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm leading-6 text-slate-600">
              {loading ? message : error}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {loading
                ? "请保持当前页面，等待机器人完成二维码扫描和设备查询。"
                : "你可以关闭弹框后重新点击带工单角标的设备节点。"}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              loading
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {loading ? "识别中..." : "关闭"}
          </button>
        </div>
      </div>
    </div>
  );
}
