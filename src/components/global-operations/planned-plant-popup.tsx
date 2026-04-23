"use client";

import {
  buildPlannedPlantRedirectUrl,
  type PlannedPlant,
} from "./planned-plant";

type PlannedPlantPopupProps = {
  plannedPlant: PlannedPlant;
  onClose: () => void;
};

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function CoordinateCard({ label, value }: { label: string; value: string }) {
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
  const regionLine = `${plannedPlant.country} · ${plannedPlant.province} · ${plannedPlant.city}`;
  const locationBlock = `${plannedPlant.country} / ${plannedPlant.province} / ${plannedPlant.city}`;

  return (
    <div className="global-site-popup-card planned-plant-popup-card">
      <div className="global-site-popup-header">
        <div className="min-w-0">
          <p className="global-site-popup-eyebrow">Planned Site</p>
          <h3 className="global-site-popup-title">{plannedPlant.name}</h3>
          <p className="global-site-popup-subtitle">{regionLine}</p>
        </div>

        <div className="global-site-popup-header-actions">
          <span className="planned-plant-popup-status">规划中</span>
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

      <div className="global-site-popup-content planned-plant-popup-content">
        <section className="global-site-popup-primary">
          <div className="planned-plant-popup-summary">
            <p className="planned-plant-popup-summary-label">
              Planning Summary
            </p>
            <p className="planned-plant-popup-summary-copy">规划中场站</p>
          </div>

          <div className="planned-plant-popup-location">
            <p className="planned-plant-popup-location-label">站点位置</p>
            <p className="planned-plant-popup-location-value">
              {locationBlock}
            </p>
          </div>
        </section>

        <section className="global-site-popup-secondary">
          <div className="planned-plant-popup-coordinate-grid">
            <CoordinateCard
              label="经度"
              value={formatCoordinate(plannedPlant.lng)}
            />
            <CoordinateCard
              label="纬度"
              value={formatCoordinate(plannedPlant.lat)}
            />
          </div>
          <div className="planned-plant-popup-actions">
            <a
              href={planningUrl}
              target="_blank"
              rel="noreferrer"
              className="global-site-popup-primary-action planned-plant-popup-primary-action"
            >
              继续规划
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
