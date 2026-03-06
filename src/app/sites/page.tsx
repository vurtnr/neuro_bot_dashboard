import type { Metadata } from "next";
import Link from "next/link";
import { siteCards, type SiteStatus } from "./data";

export const metadata: Metadata = {
  title: "场站列表 - 光伏运维系统",
  description: "光伏场站列表与状态总览页面",
};

function StatusPill({ status }: { status: SiteStatus }) {
  const isWarning = status === "告警";

  return (
    <div
      className={`flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm ${
        isWarning
          ? "border-slate-200 bg-white/90 text-amber-600"
          : "border-slate-200 bg-white/90 text-emerald-600"
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${isWarning ? "bg-amber-500" : "bg-emerald-500"}`} />
      {status}
    </div>
  );
}

export default function SitesPage() {
  return (
    <main className="min-h-screen bg-[#f6f6f8] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-5 md:px-10 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl text-[#135bec]" aria-hidden>
                ☀
              </span>
              <h2 className="text-lg font-bold tracking-[-0.015em]">光储运维系统</h2>
            </div>
            <label className="hidden h-10 min-w-40 max-w-64 flex-col md:flex">
              <div className="flex h-full w-full items-center overflow-hidden rounded-lg bg-slate-100">
                <span className="px-3 text-slate-500" aria-hidden>
                  🔍
                </span>
                <input
                  placeholder="搜索"
                  className="h-full w-full border-none bg-transparent px-2 text-sm text-slate-900 placeholder:text-slate-500 focus:ring-0 focus:outline-none"
                />
              </div>
            </label>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-7 md:flex">
              <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
                仪表盘
              </a>
              <a href="#" className="text-sm font-medium text-[#135bec]">
                场站
              </a>
              <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
                报表
              </a>
              <a href="#" className="text-sm font-medium text-slate-600 transition-colors hover:text-[#135bec]">
                设置
              </a>
            </nav>
            <div
              className="h-10 w-10 rounded-full border-2 border-[#135bec]/20 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC3rmDZU2sn5Mhra4_VJWiFYxVhoVarpxcV1_LAPIq__MYctET4xIltK3gcB2qJK1DGSNW--p5WvFPultpal22OBXFwoUuq4JN_NS6whgxQGdIveLRfPQHNHw-8zfMFNnzM4hB1LxrgdvDMSjd1aeii8u6zAb55V_vsgi1A0HA0ZRPx1mD8NGbjn673fMMRv5qrpuwp59cvhltIiqMuj7COHxXxleDAZlfVzS5Dvd_YNCQ4XjRbR1XegEPDn15BQSjFTHxJ4D3z8bF5')",
              }}
            />
          </div>
        </header>

        <section className="mb-6 flex flex-col gap-4 px-2 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-72 flex-col gap-1">
            <h1 className="text-3xl leading-tight font-bold tracking-tight">场站列表</h1>
            <p className="text-sm text-slate-500">选择一个场站以查看详情和监控性能</p>
          </div>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#135bec] px-4 text-sm font-medium text-white shadow-sm shadow-[#135bec]/30 transition-colors hover:bg-[#0f4cc7]">
            <span aria-hidden>+</span>
            添加场站
          </button>
        </section>

        <section className="mb-6 flex flex-col gap-4 px-2 lg:flex-row">
          <label className="h-11 w-full lg:max-w-md">
            <div className="flex h-full w-full items-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <span className="px-3 text-slate-500" aria-hidden>
                🔍
              </span>
              <input
                placeholder="按名称或位置搜索场站"
                className="h-full w-full border-none bg-transparent px-2 text-sm text-slate-900 placeholder:text-slate-500 focus:ring-0 focus:outline-none"
              />
            </div>
          </label>

          <div className="flex flex-wrap gap-3">
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              所有状态
              <span aria-hidden>▾</span>
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              正常
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              告警
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:ml-0">
              筛选
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 px-2 pb-10 md:grid-cols-2 lg:grid-cols-3">
          {siteCards.map((site) => {
            const isWarning = site.status === "告警";

            return (
              <article
                key={site.id}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/sites/${site.id}`} className="block">
                  <div className="relative h-48 w-full bg-slate-200">
                    <div
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url('${site.imageUrl}')` }}
                    />
                    <div className="absolute top-3 left-3">
                      <StatusPill status={site.status} />
                    </div>
                    <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm backdrop-blur-md transition-colors group-hover:bg-white">
                      ...
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 p-5">
                    <div>
                      <h3 className="text-lg leading-tight font-bold text-slate-900 transition-colors group-hover:text-[#135bec]">
                        {site.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">{site.location}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div className="flex flex-col">
                        <p className="text-xs font-medium tracking-wider text-slate-500">当前功率</p>
                        <div className="mt-1 flex items-baseline gap-1">
                          <p className="text-2xl font-bold text-slate-900">{site.currentPower}</p>
                          <p className="text-sm font-medium text-slate-500">MW</p>
                        </div>
                        {site.hint ? (
                          <p className={`mt-1 text-xs ${isWarning ? "text-amber-600" : "text-slate-500"}`}>{site.hint}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs font-medium tracking-wider text-slate-500">装机容量</p>
                        <div className="mt-1 flex items-baseline gap-1">
                          <p className="text-2xl font-bold text-slate-900">{site.capacity}</p>
                          <p className="text-sm font-medium text-slate-500">MW</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
