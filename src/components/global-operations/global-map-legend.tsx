import type { GlobalSummary } from "@/app/global-operations/data";

type GlobalMapLegendProps = {
  summary: GlobalSummary;
};

const legendItems = [
  {
    key: "connected",
    label: "在线",
    tone: "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.9)]",
    getValue: (summary: GlobalSummary) => summary.connectedSites,
  },
  {
    key: "warning",
    label: "告警",
    tone: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.85)]",
    getValue: (summary: GlobalSummary) => summary.warningCount,
  },
  {
    key: "unconnected",
    label: "离线",
    tone: "bg-slate-400 shadow-[0_0_14px_rgba(148,163,184,0.55)]",
    getValue: (summary: GlobalSummary) => summary.unconnectedCount,
  },
] as const;

export function GlobalMapLegend({ summary }: GlobalMapLegendProps) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/85 bg-white/74 px-4 py-4 shadow-[0_18px_40px_rgba(123,167,194,0.14)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(255,255,255,0.66)_58%,rgba(223,243,255,0.72)_100%)]" />

      <p className="relative text-[10px] font-semibold tracking-[0.24em] text-sky-800 uppercase">
        站点图例
      </p>

      <div className="relative mt-3 space-y-2.5">
        {legendItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-[18px] border border-slate-100 bg-white/82 px-3.5 py-2.5 shadow-[0_8px_22px_rgba(123,167,194,0.08)]"
          >
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
              <span className="text-[13px] text-slate-700">{item.label}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {item.getValue(summary)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
