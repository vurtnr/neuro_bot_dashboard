import type { GlobalSummary } from "@/app/global-operations/data";

type GlobalStatsHudProps = {
  summary: GlobalSummary;
};

const metricCards = [
  {
    key: "totalSites",
    eyebrow: "全局站点规模",
    label: "总站点数",
    icon: "◔",
    getValue: (summary: GlobalSummary) => `${summary.totalSites}`,
    getDescription: (summary: GlobalSummary) =>
      `已纳入全局指挥网络的场站共计 ${summary.totalSites} 座，其中 ${summary.connectedSites} 座保持在线。`,
  },
  {
    key: "onlineRate",
    eyebrow: "在线站点占比",
    label: "在线率",
    icon: "◷",
    getValue: (summary: GlobalSummary) => `${summary.onlineRate.toFixed(1)}%`,
    getDescription: (summary: GlobalSummary) =>
      `当前共有 ${summary.warningCount} 条活跃告警，正在影响场站运行连续性。`,
  },
  {
    key: "totalCapacityMw",
    eyebrow: "总装机容量",
    label: "装机容量",
    icon: "◶",
    getValue: (summary: GlobalSummary) => `${summary.totalCapacityMw.toFixed(0)} 兆瓦`,
    getDescription: () => "覆盖全球并网发电与储能系统的累计装机容量。",
  },
] as const;

export function GlobalStatsHud({ summary }: GlobalStatsHudProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
      {metricCards.map((card) => (
        <article
          key={card.key}
          className="relative overflow-hidden rounded-[24px] border border-white/85 bg-white/74 px-4 py-4 shadow-[0_18px_40px_rgba(123,167,194,0.14)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(255,255,255,0.66)_58%,rgba(223,243,255,0.72)_100%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <p className="max-w-[10rem] text-[10px] font-semibold tracking-[0.2em] text-sky-800 uppercase">
              {card.eyebrow}
            </p>
            <span className="text-sm text-sky-600/70">{card.icon}</span>
          </div>

          <p className="relative mt-4 text-[2.65rem] leading-none font-semibold tracking-[-0.08em] text-slate-950">
            {card.getValue(summary)}
          </p>
          <p className="relative mt-2 text-[11px] font-semibold tracking-[0.14em] text-slate-800 uppercase">
            {card.label}
          </p>
          <p className="relative mt-2.5 text-[12px] leading-5 text-slate-600">
            {card.getDescription(summary)}
          </p>
        </article>
      ))}
    </section>
  );
}
