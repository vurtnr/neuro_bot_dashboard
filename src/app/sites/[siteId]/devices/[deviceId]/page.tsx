import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteById, siteCards } from "../../../data";

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

export async function generateMetadata({ params }: DeviceDetailPageProps): Promise<Metadata> {
  const { siteId, deviceId } = await params;
  const site = getSiteById(siteId);

  if (!site || deviceId !== SUPPORTED_DEVICE_ID) {
    return {
      title: "设备详情 - 未找到",
      description: "未找到对应设备信息",
    };
  }

  return {
    title: `${site.name} 逆变器B - 设备详情与告警`,
    description: `${site.name} 逆变器B设备详情、历史性能与错误日志`,
  };
}

export default async function DeviceDetailPage({ params }: DeviceDetailPageProps) {
  const { siteId, deviceId } = await params;
  const site = getSiteById(siteId);

  if (!site || deviceId !== SUPPORTED_DEVICE_ID) {
    notFound();
  }

  const hasWarning = site.status === "告警";

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center gap-3">
              <div className="text-[#135bec]">◆</div>
              <h2 className="text-base font-bold tracking-[-0.015em] md:text-lg">光伏运维系统</h2>
            </div>
            <nav className="hidden items-center gap-6 md:flex">
              <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
                控制台
              </a>
              <a href="#" className="relative text-sm font-medium text-[#135bec] after:absolute after:-bottom-5 after:left-0 after:h-0.5 after:w-full after:bg-[#135bec]">
                设备管理
              </a>
              <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
                工单管理
              </a>
              <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
                设置
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <label className="hidden h-10 min-w-40 max-w-64 md:flex">
              <div className="flex w-full items-center rounded-lg border border-slate-300 bg-white">
                <span className="px-3 text-slate-400">⌕</span>
                <input
                  placeholder="搜索设备..."
                  className="h-full w-full border-none bg-transparent px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <div className="flex gap-3">
              <button className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200">
                ◉
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200">
                ◎
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3 text-blue-800">
              <span>🤖</span>
              <span className="text-sm font-medium">B区机器人巡检指令已就绪，等待下发。</span>
            </div>
            <button className="text-sm font-medium text-[#135bec] hover:text-blue-700">下发指令</button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/sites" className="font-medium text-slate-600 transition-colors hover:text-slate-900">
              场站
            </Link>
            <span className="text-slate-400">&gt;</span>
            <Link href={`/sites/${siteId}`} className="font-medium text-slate-600 transition-colors hover:text-slate-900">
              {site.name}
            </Link>
            <span className="text-slate-400">&gt;</span>
            <span className="font-medium text-black">设备详情 (逆变器 B-12)</span>
          </div>

          <section
            className={`flex flex-col justify-between gap-6 rounded-xl border p-6 shadow-sm md:flex-row md:items-start ${
              hasWarning ? "border-pink-200 bg-pink-50" : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="flex items-center gap-6">
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-lg border bg-white shadow-sm ${
                  hasWarning ? "border-pink-100 text-red-500" : "border-emerald-100 text-emerald-600"
                }`}
              >
                <span className="text-4xl">{hasWarning ? "⚠" : "✓"}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-black">逆变器 B-12</h1>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      hasWarning ? "border-red-200 bg-red-100 text-red-700" : "border-emerald-200 bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {hasWarning ? "异常" : "正常"}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-700">位置：B区4排 • 型号：PV-INV-500K • 序列号：849201847</p>
              </div>
            </div>
            <Link
              href={`/sites/${siteId}/devices/${deviceId}/work-order`}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#135bec] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-600 md:w-auto"
            >
              <span>🛠</span>
              <span>处理工单</span>
            </Link>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-sm font-medium">实时数据 (功率)</span>
                <span>⚡</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-black">150</p>
                <span className="text-sm text-slate-600">kW</span>
              </div>
              <div className={`mt-1 flex items-center gap-1 text-sm font-medium ${hasWarning ? "text-red-600" : "text-green-600"}`}>
                <span>{hasWarning ? "↘" : "✓"}</span>
                <span>{hasWarning ? "比预期低 15%" : "输出稳定"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-sm font-medium">日发电量</span>
                <span>☀</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-black">1,200</p>
                <span className="text-sm text-slate-600">kWh</span>
              </div>
              <div className={`mt-1 flex items-center gap-1 text-sm font-medium ${hasWarning ? "text-red-600" : "text-green-600"}`}>
                <span>{hasWarning ? "↘" : "✓"}</span>
                <span>{hasWarning ? "比昨日低 5%" : "较昨日提升 2%"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-sm font-medium">电流</span>
                <span>∿</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-bold ${hasWarning ? "text-red-600" : "text-black"}`}>{hasWarning ? "376" : "298"}</p>
                <span className="text-sm text-slate-600">A</span>
              </div>
              <div className={`mt-1 flex items-center gap-1 text-sm font-medium ${hasWarning ? "text-red-600" : "text-green-600"}`}>
                <span>{hasWarning ? "↗" : "✓"}</span>
                <span>{hasWarning ? "电流偏高警告" : "正常范围"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-sm font-medium">电压</span>
                <span>⌁</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-black">398</p>
                <span className="text-sm text-slate-600">V</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm font-medium text-green-600">
                <span>✓</span>
                <span>正常范围</span>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-bold text-black">历史性能</h2>
                <div className="flex rounded-lg bg-slate-100 p-1">
                  <button className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-black shadow-sm">今天</button>
                  <button className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900">7天</button>
                  <button className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900">1个月</button>
                </div>
              </div>
              <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="absolute bottom-0 left-0 flex h-full w-full items-end gap-2 p-4">
                  <div className="h-[20%] w-full rounded-t-sm bg-blue-500 opacity-80" />
                  <div className="h-[40%] w-full rounded-t-sm bg-blue-500 opacity-80" />
                  <div className="h-[60%] w-full rounded-t-sm bg-blue-500 opacity-80" />
                  <div className="h-[80%] w-full rounded-t-sm bg-blue-500 opacity-80" />
                  <div className="h-[90%] w-full rounded-t-sm bg-blue-500 opacity-80" />
                  <div className="h-[40%] w-full rounded-t-sm bg-blue-300 opacity-80" />
                  <div className="h-[30%] w-full rounded-t-sm bg-blue-300 opacity-80" />
                  <div className="h-[20%] w-full rounded-t-sm bg-blue-300 opacity-80" />
                </div>
                <span className="z-10 rounded bg-white/80 px-2 py-1 text-sm font-medium text-slate-700">实际输出功率 (kW) 与预期对比</span>
              </div>
            </div>

            <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold text-black">错误日志</h2>
              <div className="flex flex-col gap-3 overflow-y-auto pr-2">
                <div className={`flex gap-3 rounded-lg border p-3 ${hasWarning ? "border-red-100 bg-red-50" : "border-emerald-100 bg-emerald-50"}`}>
                  <span className={hasWarning ? "text-red-600" : "text-emerald-600"}>{hasWarning ? "✖" : "✓"}</span>
                  <div>
                    <p className={`text-sm font-bold ${hasWarning ? "text-red-900" : "text-emerald-900"}`}>
                      {hasWarning ? "IGBT 过温" : "状态正常"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {hasWarning ? "上午 10:42 - 温度达到 65°C。怀疑冷却风扇故障。" : "上午 10:42 - 温度 46°C，散热系统运行正常。"}
                    </p>
                  </div>
                </div>
                <div className={`flex gap-3 rounded-lg border p-3 ${hasWarning ? "border-orange-100 bg-orange-50" : "border-slate-200 bg-slate-50"}`}>
                  <span className={hasWarning ? "text-orange-600" : "text-slate-500"}>{hasWarning ? "!" : "i"}</span>
                  <div>
                    <p className={`text-sm font-bold ${hasWarning ? "text-orange-900" : "text-slate-900"}`}>
                      {hasWarning ? "效率下降" : "效率稳定"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {hasWarning ? "上午 10:30 - 输出功率比预期曲线下降 15%。" : "上午 10:30 - 输出功率与预期偏差在 2% 内。"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="text-slate-500">i</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">例行同步</p>
                    <p className="mt-1 text-xs font-medium text-slate-600">上午 09:00 - 系统遥测数据同步成功。</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
