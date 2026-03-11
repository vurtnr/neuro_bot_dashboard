import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSiteById, siteCards } from "../../../data";
import DeviceDetailClient from "./device-detail-client";

const SUPPORTED_DEVICE_ID = "inverter-b";

interface DeviceDetailPageProps {
  params: Promise<{
    siteId: string;
    deviceId: string;
  }>;
}

export function generateStaticParams() {
  return siteCards.map((site) => ({
    siteId: site.id,
    deviceId: SUPPORTED_DEVICE_ID,
  }));
}

export async function generateMetadata({
  params,
}: DeviceDetailPageProps): Promise<Metadata> {
  const { siteId, deviceId } = await params;
  const site = getSiteById(siteId);

  if (!site || deviceId !== SUPPORTED_DEVICE_ID) {
    return {
      title: "设备详情 - 未找到",
      description: "未找到对应设备信息",
    };
  }

  return {
    title: `${site.name} 设备详情`,
    description: `${site.name} 设备详情与工单处理面板`,
  };
}

export default async function DeviceDetailPage({
  params,
}: DeviceDetailPageProps) {
  const { siteId, deviceId } = await params;
  const site = getSiteById(siteId);

  if (!site || deviceId !== SUPPORTED_DEVICE_ID) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
          正在加载设备详情...
        </div>
      }
    >
      <DeviceDetailClient
        siteId={siteId}
        siteName={site.name}
        hasWarning={site.status === "告警"}
      />
    </Suspense>
  );
}
