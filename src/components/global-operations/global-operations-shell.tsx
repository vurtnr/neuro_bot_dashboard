import type { ReactNode } from "react";

type GlobalOperationsShellProps = {
  toast?: ReactNode;
  header: ReactNode;
  stats: ReactNode;
  scene: ReactNode;
  legend: ReactNode;
  ticker: ReactNode;
  children?: ReactNode;
};

export function GlobalOperationsShell({
  toast,
  header,
  stats,
  scene,
  legend,
  ticker,
  children,
}: GlobalOperationsShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef7ff] text-slate-900 xl:h-[100svh] xl:min-h-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.96),transparent_22%),radial-gradient(circle_at_15%_18%,rgba(112,193,255,0.22),transparent_20%),radial-gradient(circle_at_84%_16%,rgba(191,233,255,0.6),transparent_16%),linear-gradient(180deg,#f9fdff_0%,#edf7ff_36%,#e2f1ff_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[180px] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] bg-[radial-gradient(circle_at_center,rgba(139,208,255,0.12),transparent_64%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-none flex-col px-3 py-3 sm:px-4 sm:py-4 xl:h-full xl:min-h-0">
        <section className="relative flex-1 xl:h-full">
          <div className="grid gap-4 xl:hidden">
            {toast ? <div className="flex justify-center">{toast}</div> : null}
            <div>{header}</div>
            <div className="h-[clamp(620px,72vh,860px)]">{scene}</div>
            <div>{stats}</div>
            <div>{legend}</div>
            <div>{ticker}</div>
          </div>

          <div className="relative hidden h-full xl:block">
            <div className="absolute inset-0">{scene}</div>

            {toast ? (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center px-4">
                <div className="pointer-events-auto">{toast}</div>
              </div>
            ) : null}

            <div
              className="pointer-events-none absolute top-4 left-4 z-30 w-[min(620px,calc(100%-2rem))]"
            >
              <div className="pointer-events-auto">{header}</div>
            </div>

            <div className="pointer-events-none absolute bottom-[5.75rem] left-4 z-30 w-[220px]">
              <div className="pointer-events-auto">{stats}</div>
            </div>

            <div className="pointer-events-none absolute right-4 bottom-24 z-30 w-[210px]">
              <div className="pointer-events-auto">{legend}</div>
            </div>

            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-30">
              <div className="pointer-events-auto">{ticker}</div>
            </div>
          </div>
        </section>
      </div>
      {children}
    </main>
  );
}
