"use client";

import type { PatrolLockedDevice } from "@/lib/robot-inspection/types";

type RobotPatrolLockCardProps = {
  open: boolean;
  device: PatrolLockedDevice | null;
  message: string;
  error: string;
  scanPending?: boolean;
  stopPending?: boolean;
  onConnect: () => void;
  onStop: () => void;
};

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-100/80 bg-white/80 px-3 py-2">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <span className="text-[11px] font-semibold text-slate-800">{value}</span>
    </div>
  );
}

export default function RobotPatrolLockCard({
  open,
  device,
  message,
  error,
  scanPending = false,
  stopPending = false,
  onConnect,
  onStop,
}: RobotPatrolLockCardProps) {
  if (!open || !device) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute top-4 right-4 z-30 w-[340px] rounded-[24px] border border-sky-200/80 bg-white/92 p-4 shadow-[0_22px_56px_rgba(14,116,144,0.18)] backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
            <span className="inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            自动巡检任务
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            {device.nodeLabel}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{device.deviceCategory}</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          待处理工单
        </span>
      </div>

      <p className="mt-4 rounded-2xl border border-sky-100/80 bg-sky-50/70 px-3 py-2 text-sm leading-6 text-slate-600">
        {message || "当前已锁定问题设备，请通过任务卡发起扫码连接。"}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <InfoRow label="设备 ID" value={device.nodeId} />
        <InfoRow label="节点类型" value={device.nodeType} />
        <InfoRow label="设备类别" value={device.deviceCategory} />
        <InfoRow label="任务标签" value="就近工单锁定" />
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={onConnect}
          disabled={scanPending || stopPending}
          className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            scanPending || stopPending
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] hover:bg-slate-800"
          }`}
        >
          {scanPending ? "扫码连接中..." : "扫码连接"}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={stopPending}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
            stopPending
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100"
          }`}
        >
          {stopPending ? "结束中..." : "结束巡检"}
        </button>
      </div>
    </div>
  );
}
