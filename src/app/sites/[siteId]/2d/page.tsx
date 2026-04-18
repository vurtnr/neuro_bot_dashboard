import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSiteById, siteCards } from "../../data";
import SiteTopology2D from "../site-topology-2d";

interface SiteDetail2DPageProps {
  params: Promise<{
    siteId: string;
  }>;
}

export async function generateStaticParams() {
  return siteCards.map((site) => ({ siteId: site.id }));
}

export async function generateMetadata({
  params,
}: SiteDetail2DPageProps): Promise<Metadata> {
  const { siteId } = await params;
  const site = getSiteById(siteId);

  if (!site) {
    return {
      title: "2D 场站详情 - 未找到",
      description: "未找到对应场站信息",
    };
  }

  return {
    title: `${site.name} - 2D 场站详情`,
    description: `${site.name} 2D 场站详情与设备拓扑状态`,
  };
}

export default async function SiteDetail2DPage({ params }: SiteDetail2DPageProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);

  if (!site) {
    notFound();
  }

  const hasWarning = site.status === "告警";
  const capacityMw = Number(site.capacity);
  const pvPowerMw = Number(site.currentPower);
  const storagePowerMw = Number((pvPowerMw * (hasWarning ? -0.22 : 0.18)).toFixed(2));
  const loadPowerMw = Number((pvPowerMw * 0.74 + capacityMw * 0.08).toFixed(2));
  const gridPowerMw = Number((pvPowerMw + storagePowerMw - loadPowerMw).toFixed(2));
  const co2ReductionTons = Number((pvPowerMw * 0.86).toFixed(2));
  const treeEquivalent = Math.round(co2ReductionTons * 46);
  const arbitrageIncome = Math.round(
    Math.abs(storagePowerMw) * 1600 + Math.max(gridPowerMw, 0) * 860,
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f6f8] text-slate-900">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
            正在加载场站详情...
          </div>
        }
      >
        <SiteTopology2D
          dashboardData={{
            siteName: site.name,
            location: site.location,
            capacity: site.capacity,
            weather: site.weather,
            hasWarning,
            pvPowerMw,
            storagePowerMw,
            loadPowerMw,
            gridPowerMw,
            treeEquivalent,
            co2ReductionTons,
            arbitrageIncome,
          }}
        />
      </Suspense>
    </main>
  );
}
