"use client";

type GlobalAlertTickerProps = {
  alerts: string[];
};

export function GlobalAlertTicker({ alerts }: GlobalAlertTickerProps) {
  const items = [...alerts, ...alerts];

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/85 bg-white/74 px-4 py-3 shadow-[0_18px_40px_rgba(123,167,194,0.14)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(255,255,255,0.66)_58%,rgba(223,243,255,0.72)_100%)]" />

      <div className="relative flex items-center gap-3 overflow-hidden">
        <div className="shrink-0 rounded-full border border-sky-100 bg-sky-50/80 px-3.5 py-1.5 text-[10px] font-semibold tracking-[0.22em] text-sky-800 uppercase">
          告警播报
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="global-alert-ticker-track flex w-max min-w-full items-center gap-3">
            {items.map((alert, index) => (
              <div
                key={`${alert}-${index}`}
                className="flex shrink-0 items-center gap-2.5 rounded-full border border-slate-100 bg-white/86 px-3.5 py-1.5 text-[13px] text-slate-700 shadow-[0_8px_18px_rgba(123,167,194,0.08)]"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]" />
                <span>{alert}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .global-alert-ticker-track {
          animation: global-alert-scroll 36s linear infinite;
        }

        @keyframes global-alert-scroll {
          0% {
            transform: translateX(0);
          }

          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
