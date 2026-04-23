"use client";

export type AbnormalWorkOrderStatus =
  | "idle"
  | "sending"
  | "sent"
  | "submitted"
  | "error";

type AbnormalWorkOrderCardProps = {
  status: AbnormalWorkOrderStatus;
  onRequestSupport: () => void;
};

function getActionLabel(status: AbnormalWorkOrderStatus) {
  switch (status) {
    case "sending":
      return "正在通知机器人";
    case "sent":
      return "等待语音确认";
    case "submitted":
      return "已提交寻求技术支持";
    case "error":
      return "重新请求技术支持";
    default:
      return "请求技术支持";
  }
}

export function AbnormalWorkOrderCard({
  status,
  onRequestSupport,
}: AbnormalWorkOrderCardProps) {
  const disabled =
    status === "sending" || status === "sent" || status === "submitted";
  const submitted = status === "submitted";

  return (
    <aside
      className={`pointer-events-auto w-[min(360px,calc(100vw-2rem))] rounded-[28px] border bg-white/88 p-5 shadow-[0_24px_70px_rgba(148,70,70,0.18)] backdrop-blur-xl ${
        submitted ? "border-emerald-200/80" : "border-rose-200/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-rose-700 uppercase">
            exception work order
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            异常状态工单
          </h3>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            submitted
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {submitted ? "已提交" : "待技术支持"}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        {submitted
          ? "天合光能运维部门已接收异常状态工单，将由运维工程师接入分析并提供技术支持。"
          : "机器人与 AI 无法确认根因时，将该工单升级给天合光能运维部门进行技术支持。"}
      </p>

      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2">
        <p className="text-xs font-semibold text-amber-800">语音确认流程</p>
        <p className="mt-1 text-xs leading-5 text-amber-700">
          点击后机器人会询问是否发送，用户语音确认后机器人播报已发送。
        </p>
      </div>

      <button
        type="button"
        onClick={onRequestSupport}
        disabled={disabled}
        className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400"
            : "bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] hover:bg-slate-800"
        }`}
      >
        {getActionLabel(status)}
      </button>
    </aside>
  );
}
