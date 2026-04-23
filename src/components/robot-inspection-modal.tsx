"use client";

import type { InspectionDialogState } from "../lib/robot-inspection/use-robot-inspection";

type RobotInspectionModalProps = {
  dialogState: InspectionDialogState;
  onClose: () => void;
  onRetryPermission: () => void;
};

function Spinner() {
  return (
    <span className="inline-flex h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
  );
}

function getTitle(phase: InspectionDialogState["phase"]) {
  switch (phase) {
    case "requesting_permission":
    case "awaiting_permission_response":
    case "retrying_permission":
      return "等待语音授权";
    case "permission_denied":
      return "语音授权被拒绝";
    case "permission_unresolved":
      return "未获得明确授权";
    case "failed":
      return "识别失败";
    default:
      return "等待设备识别";
  }
}

function isLoadingPhase(phase: InspectionDialogState["phase"]) {
  switch (phase) {
    case "requesting_permission":
    case "awaiting_permission_response":
    case "retrying_permission":
    case "waiting_for_qr":
    case "qr_detected":
    case "ble_connecting":
    case "querying_device":
      return true;
    default:
      return false;
  }
}

export default function RobotInspectionModal({
  dialogState,
  onClose,
  onRetryPermission,
}: RobotInspectionModalProps) {
  if (!dialogState.open) {
    return null;
  }

  const loading = isLoadingPhase(dialogState.phase);
  const showPermissionRetry = dialogState.phase === "permission_denied";
  const showClose = !loading;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
          机器人巡检
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          {getTitle(dialogState.phase)}
        </h2>
        <div className="mt-5 flex items-start gap-4">
          {loading ? (
            <div className="mt-1 shrink-0">
              <Spinner />
            </div>
          ) : (
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg text-amber-700">
              !
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm leading-6 text-slate-600">
              {dialogState.message}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {dialogState.detail}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {showPermissionRetry ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                结束本次复核
              </button>
              <button
                type="button"
                onClick={onRetryPermission}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                重新请求语音确认
              </button>
            </>
          ) : null}
          {showClose && !showPermissionRetry ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              关闭
            </button>
          ) : null}
          {loading ? (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
            >
              处理中...
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
