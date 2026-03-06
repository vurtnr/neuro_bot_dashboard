import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteById, siteCards } from "../../../../data";

const SUPPORTED_DEVICE_ID = "inverter-b";

interface WorkOrderPageProps {
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

export async function generateMetadata({ params }: WorkOrderPageProps): Promise<Metadata> {
  const { siteId, deviceId } = await params;
  const site = getSiteById(siteId);

  if (!site || deviceId !== SUPPORTED_DEVICE_ID) {
    return {
      title: "工单处理 - 未找到",
      description: "未找到对应工单信息",
    };
  }

  return {
    title: `${site.name} - 工单处理`,
    description: `${site.name} 逆变器B工单处理页面`,
  };
}

export default async function WorkOrderPage({ params }: WorkOrderPageProps) {
  const { siteId, deviceId } = await params;
  const site = getSiteById(siteId);

  if (!site || deviceId !== SUPPORTED_DEVICE_ID) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f6f6f8] text-slate-900">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 lg:px-10">
        <div className="flex items-center gap-4 text-[#135bec]">
          <span className="text-3xl">☀</span>
          <h2 className="text-lg font-bold tracking-[-0.015em] text-slate-900">光伏运维系统</h2>
        </div>
        <div className="flex flex-1 items-center justify-end gap-8">
          <nav className="hidden items-center gap-9 md:flex">
            <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
              仪表盘
            </a>
            <a href="#" className="border-b-2 border-[#135bec] pb-1 text-sm font-bold text-[#135bec]">
              工单管理
            </a>
            <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
              机器人
            </a>
            <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
              系统设置
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-500 transition-colors hover:text-slate-700">
              ○
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full border border-white bg-red-500" />
            </button>
            <div
              className="h-10 w-10 rounded-full border border-slate-200 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC0-_nMMYVW2NwTu7jjw9HtliQ3jICb_MevW9k7fY4kqNHlpwRTJQbhqo4p14LnfYHMp9qdpPbXQc1GnFF64PFv7WQWUN4brN939e57ms_yIYppRo2IgNORNmOu4g7m4T2mtqdy0TMx24XpP1myfkvZUofACbCo7q_r8P1bUvbMoMhV9BmFmtqro3jWr1HMy_f1dP4w6xJ_9ov9B5nVud497UEjttwNGDH2hpro9oGHsDt4s8SlME91g6YU3aB2RIOc7eS4I__OC3gB')",
              }}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-full max-w-sm shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-wider text-slate-900 uppercase">
              <span className="text-base text-[#135bec]">🤖</span>
              机器人状态
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-green-500">📶</span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">网络连接</p>
                    <p className="text-sm font-bold text-slate-900">已连接 (5G)</p>
                  </div>
                </div>
                <span className="relative flex h-2.5 w-2.5 rounded-full bg-green-500">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[#135bec]">🔋</span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">电池电量</p>
                    <p className="text-sm font-bold text-slate-900">87%</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-500">剩余约4小时</span>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider text-slate-900 uppercase">回传参数</h3>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                ⟳
                实时
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-sm">
              <div className="grid grid-cols-2 gap-px">
                <div className="bg-white p-3">
                  <p className="text-xs font-medium text-slate-500">电压</p>
                  <p className="text-sm font-bold text-slate-900">800.4 V</p>
                </div>
                <div className="bg-white p-3">
                  <p className="text-xs font-medium text-slate-500">电流</p>
                  <p className="text-sm font-bold text-slate-900">120.2 A</p>
                </div>
                <div className="bg-white p-3">
                  <p className="text-xs font-medium text-slate-500">内部温度</p>
                  <p className="text-sm font-bold text-orange-500">48.5 °C</p>
                </div>
                <div className="bg-white p-3">
                  <p className="text-xs font-medium text-slate-500">湿度</p>
                  <p className="text-sm font-bold text-slate-900">32%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-wider text-slate-900 uppercase">
              <span className="text-base text-slate-500">💬</span>
              语音播报内容及日志
            </h3>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-2">
              <div className="flex gap-3">
                <div className="mt-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#135bec]/20 text-[14px] text-[#135bec]">🎙</div>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs text-slate-500">上午 10:42:15 • 机器人 Alpha</p>
                  <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-sm text-slate-700">
                    「正在接近逆变器站 A。启动视觉检查程序。」
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-[14px] text-orange-500">!</div>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs text-slate-500">上午 10:45:30 • 系统警报</p>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                    逆变器模块 3 检测到热异常。表面温度超过 60°C。
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#135bec]/20 text-[14px] text-[#135bec]">🎙</div>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs text-slate-500">上午 10:46:12 • 机器人 Alpha</p>
                  <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-sm text-slate-700">
                    「正在捕获高分辨率红外热扫描并上传到中心节点。」
                  </div>
                </div>
              </div>

              <div className="ml-9 flex w-max items-center gap-2 rounded-md border border-slate-200 bg-slate-100 p-2">
                <span>🖼</span>
                <span className="text-xs font-medium text-slate-700">IR_scan_inv_3.jpg</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-y-auto bg-white">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 lg:p-10">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="rounded-md bg-orange-100 px-2.5 py-1 text-xs font-bold tracking-wide text-orange-700 uppercase">高优先级</span>
                <span className="text-sm text-slate-500">创建于：今天，上午 09:15</span>
              </div>
              <h1 className="text-2xl leading-tight font-bold text-slate-900 md:text-3xl">站 A - 逆变器热异常检查</h1>
              <p className="mt-2 font-mono text-sm text-slate-500">工单号：WO-2023-0891</p>
            </div>

            <form className="flex flex-col gap-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <span className="text-[#135bec]">🧪</span>
                  故障诊断
                </h2>
                <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">故障组件</label>
                    <select className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 shadow-sm transition-colors outline-none focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec]">
                      <option>逆变器模块 3 (INV-A-03)</option>
                      <option>散热风扇总成</option>
                      <option>直流连接端子</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">故障模式</label>
                    <select className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 shadow-sm transition-colors outline-none focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec]">
                      <option>过热 (热异常)</option>
                      <option>通讯丢失</option>
                      <option>电压跌落</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">诊断结果</label>
                  <textarea
                    rows={4}
                    placeholder="详细说明确定的根本原因..."
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm transition-colors outline-none focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <span className="text-[#135bec]">🛠</span>
                  维修操作
                </h2>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">执行操作</label>
                    <textarea
                      rows={3}
                      placeholder="描述为解决问题而采取的步骤..."
                      className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm transition-colors outline-none focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">更换/使用的部件</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="搜索库存或输入部件号..."
                        className="flex-1 rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 shadow-sm transition-colors outline-none focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec]"
                      />
                      <button
                        type="button"
                        className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-300"
                      >
                        添加部件
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <span className="text-[#135bec]">📷</span>
                    证据与照片
                  </h2>
                  <button type="button" className="text-sm font-medium text-[#135bec] hover:underline">
                    从机器人导入
                  </button>
                </div>
                <div className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center transition-colors hover:bg-slate-100">
                  <span className="mb-2 block text-4xl text-slate-400">⤴</span>
                  <p className="text-sm font-medium text-slate-700">点击上传或拖放文件</p>
                  <p className="mt-1 text-xs text-slate-500">SVG、PNG、JPG 或 PDF (最大 10MB)</p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-4 border-t border-slate-200 pt-4">
                <button type="button" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100">
                  保存草稿
                </button>
                <button type="button" className="flex items-center gap-2 rounded-lg bg-[#135bec] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0f4cc7]">
                  ✓
                  提交处理结果
                </button>
              </div>
            </form>

            <div className="text-sm text-slate-500">
              当前场站：
              <Link href={`/sites/${siteId}`} className="ml-1 font-medium text-[#135bec] hover:underline">
                {site.name}
              </Link>
              ，设备：
              <Link href={`/sites/${siteId}/devices/${deviceId}`} className="ml-1 font-medium text-[#135bec] hover:underline">
                逆变器 B-12
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
