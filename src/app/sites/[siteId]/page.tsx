import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteById, siteCards } from "../data";
import SiteTopologyFlow from "./site-topology-flow";

interface SiteDetailPageProps {
  params: Promise<{
    siteId: string;
  }>;
}

export async function generateStaticParams() {
  return siteCards.map((site) => ({ siteId: site.id }));
}

export async function generateMetadata({ params }: SiteDetailPageProps): Promise<Metadata> {
  const { siteId } = await params;
  const site = getSiteById(siteId);

  if (!site) {
    return {
      title: "场站详情 - 未找到",
      description: "未找到对应场站信息",
    };
  }

  return {
    title: `${site.name} - 场站详情与拓扑`,
    description: `${site.name} 场站详情与设备拓扑状态`,
  };
}

export default async function SiteDetailPage({ params }: SiteDetailPageProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);

  if (!site) {
    notFound();
  }

  const hasWarning = site.status === "告警";

  return (
    <main className="h-screen overflow-hidden bg-[#f6f6f8] text-slate-900">
      <div className="flex h-full flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-bold tracking-tight">{site.name}</h1>
            <p className="text-sm text-slate-500">实时设备拓扑图与状态监控</p>
          </div>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#135bec] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0f4cc7]">
            ⬇
            导出报表
          </button>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-lg bg-[#135bec]/10 p-2 text-[#135bec]">📍</div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">位置</span>
              <span className="text-lg font-bold text-slate-900">{site.location}</span>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-lg bg-[#135bec]/10 p-2 text-[#135bec]">⚡</div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">装机容量</span>
              <span className="text-lg font-bold text-slate-900">{site.capacity} MW</span>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-lg bg-orange-500/10 p-2 text-orange-500">☀</div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">天气</span>
              <span className="text-lg font-bold text-slate-900">{site.weather}</span>
            </div>
          </div>
          <div
            className={`flex items-start gap-4 rounded-xl p-5 shadow-sm ${
              hasWarning ? "border border-red-500/30 bg-red-50" : "border border-emerald-500/30 bg-emerald-50"
            }`}
          >
            <div className={`rounded-lg p-2 ${hasWarning ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-600"}`}>
              {hasWarning ? "!" : "✓"}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">状态</span>
              <span className={`text-lg font-bold ${hasWarning ? "text-red-600" : "text-emerald-600"}`}>
                {hasWarning ? "部分告警" : "运行正常"}
              </span>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1">
          <SiteTopologyFlow />
        </section>
      </div>
    </main>
  );
}
