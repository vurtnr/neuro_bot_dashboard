"use client";

import {
  buildPlannedPlantMetrics,
  buildPlannedPlantRedirectUrl,
  getPlannedPlantRegionLabel,
  type PlannedPlant,
} from "./planned-plant";

type PlannedPlantPopupProps = {
  plannedPlant: PlannedPlant;
  onClose: () => void;
};

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="global-site-popup-metric">
      <span className="global-site-popup-metric-label">{label}</span>
      <strong className="global-site-popup-metric-value">{value}</strong>
    </div>
  );
}

export function PlannedPlantPopup({
  plannedPlant,
  onClose,
}: PlannedPlantPopupProps) {
  const planningUrl = buildPlannedPlantRedirectUrl(plannedPlant.plantId);
  const metrics = buildPlannedPlantMetrics(plannedPlant);

  return (
    <div className="global-site-popup-card">
      <div className="global-site-popup-header">
        <div className="min-w-0">
          <p className="global-site-popup-eyebrow">规划中新场站</p>
          <h3 className="global-site-popup-title">{plannedPlant.name}</h3>
          <p className="global-site-popup-subtitle">
            {getPlannedPlantRegionLabel(plannedPlant)}
          </p>
        </div>

        <div className="global-site-popup-header-actions">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            规划中
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭规划场站浮窗"
            className="global-site-popup-close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="global-site-popup-content">
        <section className="global-site-popup-primary">
          <div className="rounded-[20px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(248,252,255,0.96))] px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-emerald-700/80 uppercase">
              Planning Queue
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              来自实时建站推送
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-100/80 bg-white/70 px-3 py-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                国家
              </p>
              <p className="mt-2 font-medium text-slate-700">
                {plannedPlant.country}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100/80 bg-white/70 px-3 py-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                省份
              </p>
              <p className="mt-2 font-medium text-slate-700">
                {plannedPlant.province}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100/80 bg-white/70 px-3 py-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                城市
              </p>
              <p className="mt-2 font-medium text-slate-700">
                {plannedPlant.city}
              </p>
            </div>
          </div>
        </section>

        <section className="global-site-popup-secondary">
          <div className="global-site-popup-meta">
            {metrics.map((metric) => (
              <MetricItem
                key={metric.label}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>
          <div className="global-site-popup-secondary-actions">
            <a
              href={planningUrl}
              target="_blank"
              rel="noreferrer"
              className="global-site-popup-primary-action"
            >
              继续规划
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
