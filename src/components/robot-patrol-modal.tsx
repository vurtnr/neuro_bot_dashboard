"use client";

type RobotPatrolModalProps = {
  open: boolean;
  loading: boolean;
  message: string;
  error: string;
  onClose: () => void;
};

function Spinner() {
  return (
    <span className="inline-flex h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-500" />
  );
}

export default function RobotPatrolModal({
  open,
  loading,
  message,
  error,
  onClose,
}: RobotPatrolModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[118] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-[28px] border border-sky-100/90 bg-white/95 p-7 shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
              自动巡检
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {loading ? "机器人正在进入巡检状态" : "巡检启动失败"}
            </h2>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
              loading
                ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {loading ? "处理中" : "需重试"}
          </span>
        </div>

        <div className="mt-6 flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="mt-1 shrink-0">
            {loading ? (
              <Spinner />
            ) : (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-lg font-semibold text-rose-600">
                !
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-6 text-slate-600">
              {loading ? message : error}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {loading
                ? "机器人会在进入自动巡检状态后自行锁定最近的待处理设备，并在页面右上角生成任务卡。"
                : "请确认机器人服务在线后重新开始巡检。"}
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
            {loading ? "巡检准备中..." : "关闭"}
          </button>
        </div>
      </div>
    </div>
  );
}
