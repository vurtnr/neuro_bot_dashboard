type GlobalHeaderProps = {
  title: string;
  description: string;
  statusLabel: string;
  actionLabel?: string;
  actionHref?: string;
};

export function GlobalHeader({
  title,
  description,
  statusLabel,
  actionLabel,
  actionHref,
}: GlobalHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/70 px-6 py-5 shadow-[0_20px_60px_rgba(123,167,194,0.16)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.62)_52%,rgba(214,240,255,0.76)_100%)]" />

      <div className="relative flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,#ffffff,#eef8ff)] text-lg text-sky-700 shadow-[0_12px_28px_rgba(112,170,207,0.12)]">
            ◎
          </span>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-sky-700/80 uppercase">
              Global Operations Center
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[1.8rem] font-semibold tracking-[-0.06em] text-slate-950">
                {title}
              </span>
              <span className="text-[1rem] font-medium text-slate-500">
                全球指挥中心
              </span>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {actionLabel && actionHref ? (
            <a
              href={actionHref}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-3 rounded-full border border-sky-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(232,246,255,0.96))] px-4 py-2.5 text-sky-900 shadow-[0_18px_34px_rgba(113,167,201,0.16)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_22px_40px_rgba(113,167,201,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 focus-visible:ring-offset-2"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/90 bg-white text-[15px] text-sky-700 shadow-[0_10px_18px_rgba(113,167,201,0.14)] transition group-hover:bg-sky-50">
                +
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-sky-600/80 uppercase">
                  Workspace
                </span>
                <span className="mt-1 text-sm font-semibold text-slate-900">
                  {actionLabel}
                </span>
              </span>
            </a>
          ) : null}

          <div className="flex items-center gap-3 rounded-full border border-sky-100 bg-white/82 px-4 py-2.5 text-sky-900 shadow-[0_14px_30px_rgba(123,167,194,0.12)]">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_0_4px_rgba(34,211,238,0.16)]" />
            </span>
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">
              {statusLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
