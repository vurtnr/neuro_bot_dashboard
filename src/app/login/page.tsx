import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "运维系统登录 - 中文版",
  description: "光伏储能电站运行维护系统登录页面",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full overflow-x-hidden bg-[#f8fafc] text-slate-900">
      <div className="z-10 flex min-h-screen w-full flex-col justify-center bg-white px-8 py-12 shadow-[8px_0_32px_rgba(0,0,0,0.04)] sm:px-16 lg:w-1/2 lg:px-24 xl:px-32">
        <div className="mx-auto flex w-full max-w-[480px] flex-col">
          <div className="pb-8">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-4xl text-[#2563eb]" aria-hidden>
                ☀
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                SolarOps
              </span>
            </div>
            <h1 className="text-4xl leading-tight font-black tracking-[-0.033em] text-slate-900">
              运维系统登录
            </h1>
            <p className="mt-2 text-base text-slate-500">
              光伏储能电站运行维护系统
            </p>
          </div>

          <form className="flex flex-col gap-5" action="/global-operations">
            <label className="flex w-full flex-col gap-1">
              <span className="text-sm font-bold text-slate-700">用户名</span>
              <div className="relative">
                <span
                  className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                >
                  👤
                </span>
                <input
                  type="text"
                  placeholder="请输入用户名"
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white pr-4 pl-12 text-base text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] focus:outline-none"
                />
              </div>
            </label>

            <label className="flex w-full flex-col gap-1">
              <span className="text-sm font-bold text-slate-700">密码</span>
              <div className="relative">
                <span
                  className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                >
                  🔒
                </span>
                <input
                  type="password"
                  placeholder="请输入密码"
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white pr-4 pl-12 text-base text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] focus:outline-none"
                />
              </div>
            </label>

            <div className="flex items-center justify-between py-1">
              <label className="group flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]/50 focus:ring-offset-0"
                />
                <span className="text-sm font-medium text-slate-600 transition-colors group-hover:text-slate-900">
                  记住我
                </span>
              </label>
              <a
                href="#"
                className="text-sm font-medium text-[#2563eb] transition-colors hover:text-[#1d4ed8]"
              >
                忘记密码？
              </a>
            </div>

            <button
              type="submit"
              className="mt-3 flex h-12 w-full items-center justify-center rounded-lg bg-[#2563eb] px-6 font-bold text-white shadow-md shadow-[#2563eb]/20 transition-all hover:bg-[#1d4ed8] focus:ring-4 focus:ring-[#2563eb]/30 focus:outline-none active:scale-[0.98]"
            >
              登录
              <span className="ml-2 text-lg" aria-hidden>
                →
              </span>
            </button>
          </form>

          <div className="mt-12 border-t border-slate-200 pt-8 text-center">
            <p className="text-sm text-slate-500">
              © 2026 SolarOps能源系统。保留所有权利。
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden w-1/2 bg-slate-100 lg:flex">
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#2563eb]/5 to-slate-200/50" />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/background.png')",
          }}
        />

        <div className="relative z-20 flex h-full w-full flex-col justify-end p-16 pb-24">
          <div className="max-w-lg rounded-2xl border border-white/50 bg-white/90 p-8 shadow-xl backdrop-blur-md">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2563eb]/20 bg-[#2563eb]/10">
                <span className="text-2xl text-[#2563eb]" aria-hidden>
                  📈
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">实时监控</h3>
                <p className="text-sm text-slate-600">当前电网容量</p>
              </div>
            </div>

            <div className="mt-6 flex gap-6">
              <div>
                <p className="mb-1 text-xs font-bold tracking-wider text-slate-500 uppercase">
                  系统效率
                </p>
                <p className="text-3xl font-black text-emerald-500">98.4%</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold tracking-wider text-slate-500 uppercase">
                  活跃节点
                </p>
                <p className="text-3xl font-black text-slate-900">1,248</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
