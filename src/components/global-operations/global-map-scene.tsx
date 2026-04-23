"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";

import {
  getGlobalSiteBounds,
  getStatusLabel,
  toGlobalSiteFeatureCollection,
  type GlobalSiteDetail,
  type GlobalSitePoint,
} from "@/app/global-operations/data";
import {
  AbnormalWorkOrderCard,
  type AbnormalWorkOrderStatus,
} from "@/components/global-operations/abnormal-work-order-card";
import {
  type PlannedPlant,
  toPlannedPlantFeatureCollection,
} from "@/components/global-operations/planned-plant";
import {
  resolveAnchoredPopupLayout,
  type PopupLayout,
} from "@/components/global-operations/planned-plant-popup-layout";
import { PlannedPlantPopup } from "@/components/global-operations/planned-plant-popup";
import { getTiandituKey } from "@/lib/robot-inspection/config";

type GlobalMapSceneProps = {
  points: GlobalSitePoint[];
  plannedPlants?: PlannedPlant[];
  anomalySiteId?: string | null;
  inspectionBusy?: boolean;
  abnormalWorkOrderStatus?: AbnormalWorkOrderStatus;
  onStartInspection?: (site: GlobalSitePoint) => void;
  onOpenAnomalyReview?: (site: GlobalSitePoint) => void;
  onOpenSiteDetail?: (site: GlobalSitePoint) => void;
  onRequestTechnicalSupport?: () => void;
};

type MapStatus = "loading" | "ready" | "failed";
type ViewMode = "globe" | "mercator";

type SiteIndicatorLayout = {
  left: number;
  top: number;
};

const TIANDITU_ATTRIBUTION =
  '&copy; <a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer">天地图</a>';

const BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#86cdf2",
      },
    },
  ],
};

const RASTER_SOURCE_ID = "world-raster";
const RASTER_LAYER_ID = "world-raster-layer";
const LABEL_SOURCE_ID = "world-label";
const LABEL_LAYER_ID = "world-label-layer";
const SITE_SOURCE_ID = "global-sites";
const SITE_HALO_LAYER_ID = "global-sites-halo";
const SITE_RING_LAYER_ID = "global-sites-ring";
const SITE_CORE_LAYER_ID = "global-sites-core";
const PLANNED_SOURCE_ID = "planned-plants";
const PLANNED_HALO_LAYER_ID = "planned-plants-halo";
const PLANNED_CORE_LAYER_ID = "planned-plants-core";

const DEFAULT_GLOBE_CENTER: [number, number] = [13.15, 4.18];
const DEFAULT_GLOBE_ZOOM = 1.02;
const GLOBE_MIN_ZOOM = 0.5;
const GLOBE_MAX_ZOOM = 2.4;
const MERCATOR_MIN_ZOOM = 0.75;
const MERCATOR_MAX_ZOOM = 4.8;
const LIGHT_SCENE_BACKGROUND = "#dff1ff";
const GLOBE_SCENE_BACKGROUND = "rgba(0, 0, 0, 0)";
const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 320;
const DEFAULT_TIANDITU_KEY = "c0cf6d9f223c83540c8b52d1faaf7bae";
const TIANDITU_KEY = getTiandituKey() || DEFAULT_TIANDITU_KEY;
const TIANDITU_IMAGE_TILES = [
  `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
  `https://t1.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
  `https://t2.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
  `https://t3.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
];
const TIANDITU_LABEL_TILES = [
  `https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
  `https://t1.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
  `https://t2.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
  `https://t3.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
];

function formatCoordinate(value: number) {
  return value.toFixed(3);
}

function MetricItem({ label, value }: { label: string; value: string }) {
  if (label === "经纬度") {
    const [lng, lat] = value.split(", ").map((item) => item.trim());

    return (
      <div className="global-site-popup-metric">
        <span className="global-site-popup-metric-label">{label}</span>
        <strong className="global-site-popup-metric-value global-site-popup-metric-value-stack">
          <span>{lng}</span>
          <span>{lat}</span>
        </strong>
      </div>
    );
  }

  const lastSpaceIndex = value.lastIndexOf(" ");
  const numericValue =
    lastSpaceIndex > 0 ? value.slice(0, lastSpaceIndex) : value;
  const unitValue =
    lastSpaceIndex > 0 ? value.slice(lastSpaceIndex + 1) : "";

  return (
    <div className="global-site-popup-metric">
      <span className="global-site-popup-metric-label">{label}</span>
      <strong className="global-site-popup-metric-value">
        <span className="global-site-popup-metric-number">{numericValue}</span>
        {unitValue ? (
          <span className="global-site-popup-metric-unit">{unitValue}</span>
        ) : null}
      </strong>
    </div>
  );
}

function getDetailBadgeTone(
  label: keyof Pick<
    GlobalSiteDetail,
    | "robotStatus"
    | "todayInspectionStatus"
    | "dataAccessStatus"
    | "anomalyReviewStatus"
  >,
  value: string,
) {
  if (label === "anomalyReviewStatus") {
    return value === "待复核1项"
      ? "bg-red-50 text-red-700 ring-1 ring-red-100"
      : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }

  if (label === "dataAccessStatus") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }

  if (label === "robotStatus") {
    if (value === "执行中") {
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
    }

    if (value === "离线") {
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    }

    if (value === "充电中") {
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-100";
    }

    return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100";
  }

  if (value === "巡检中") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  }

  if (value === "已完成") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }

  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

function StatusPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const isActionable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isActionable}
      className={`global-site-popup-chip ${isActionable ? "global-site-popup-chip-actionable" : ""}`}
    >
      <span className="global-site-popup-chip-label">{label}</span>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getDetailBadgeTone(
          label as
            | "robotStatus"
            | "todayInspectionStatus"
            | "dataAccessStatus"
            | "anomalyReviewStatus",
          value,
        )}`}
      >
        {value}
      </span>
    </button>
  );
}

function SitePopupCard({
  site,
  inspectionBusy,
  onClose,
  onStartInspection,
  onOpenAnomalyReview,
  onOpenSiteDetail,
}: {
  site: GlobalSitePoint;
  inspectionBusy?: boolean;
  onClose: () => void;
  onStartInspection?: (site: GlobalSitePoint) => void;
  onOpenAnomalyReview?: (site: GlobalSitePoint) => void;
  onOpenSiteDetail?: (site: GlobalSitePoint) => void;
}) {
  return (
    <div className="global-site-popup-card">
      <div className="global-site-popup-header">
        <div className="min-w-0">
          <p className="global-site-popup-eyebrow">全球站点监测</p>
          <h3 className="global-site-popup-title">{site.name}</h3>
          <p className="global-site-popup-subtitle">
            {site.region} · {site.details.siteType}
          </p>
        </div>

        <div className="global-site-popup-header-actions">
          <span
            className={`global-site-popup-status global-site-popup-status-${site.status}`}
          >
            {getStatusLabel(site.status)}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭场站信息浮窗"
            className="global-site-popup-close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="global-site-popup-content">
        <section className="global-site-popup-primary">
          <div className="global-site-popup-chip-row">
            <StatusPill label="机器人状态" value={site.details.robotStatus} />
            <StatusPill
              label="今日巡检状态"
              value={site.details.todayInspectionStatus}
            />
            <StatusPill
              label="数据接入状态"
              value={site.details.dataAccessStatus}
            />
            <StatusPill
              label="异常复核"
              value={site.details.anomalyReviewStatus}
              onClick={
                site.details.anomalyReviewStatus === "待复核1项"
                  ? () => onOpenAnomalyReview?.(site)
                  : undefined
              }
            />
          </div>

          <div className="global-site-popup-footer">
            <div className="global-site-popup-inline-meta">
              <p className="global-site-popup-footer-line">
                运营单位：{site.details.operator}
              </p>
              <p className="global-site-popup-footer-line">
                并网方式：{site.details.gridProfile}
              </p>
            </div>
            <div className="global-site-popup-inline-meta">
              <p className="global-site-popup-footer-line">
                本地时间：{site.details.localTimeLabel}
              </p>
              <p className="global-site-popup-footer-line">
                最近同步：{site.details.lastSyncLabel}
              </p>
            </div>
          </div>
        </section>

        <section className="global-site-popup-secondary">
          <div className="global-site-popup-meta">
            <MetricItem
              label="经纬度"
              value={`${formatCoordinate(site.lng)}, ${formatCoordinate(site.lat)}`}
            />
            <MetricItem label="海拔" value={`${site.details.elevationM} m`} />
            <MetricItem label="装机容量" value={`${site.capacityMw.toFixed(0)} MW`} />
            <MetricItem
              label="实时功率"
              value={`${site.details.livePowerMw.toFixed(1)} MW`}
            />
            <MetricItem
              label="今日发电"
              value={`${site.details.todayGenerationMwh.toFixed(1)} MWh`}
            />
            <MetricItem
              label="环境温度"
              value={`${site.details.ambientTempC.toFixed(1)} °C`}
            />
            <MetricItem
              label="辐照强度"
              value={`${site.details.irradianceWm2.toFixed(0)} W/m²`}
            />
            <MetricItem
              label="风速"
              value={`${site.details.windSpeedMs.toFixed(1)} m/s`}
            />
          </div>
          <div className="global-site-popup-secondary-actions">
            <button
              type="button"
              className="global-site-popup-primary-action"
              onClick={() => onOpenSiteDetail?.(site)}
            >
              场站详情
            </button>
            <button
              type="button"
              className="global-site-popup-primary-action disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onStartInspection?.(site)}
              disabled={inspectionBusy}
            >
              {inspectionBusy ? "巡检执行中" : "开始巡检"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ensureBasemapSourcesAndLayers(map: MapLibreMap) {
  if (!map.getSource(RASTER_SOURCE_ID)) {
    map.addSource(RASTER_SOURCE_ID, {
      type: "raster",
      tiles: TIANDITU_IMAGE_TILES,
      tileSize: 256,
      minzoom: 0,
      maxzoom: 20,
      attribution: TIANDITU_ATTRIBUTION,
    });
  }

  if (!map.getLayer(RASTER_LAYER_ID)) {
    map.addLayer({
      id: RASTER_LAYER_ID,
      type: "raster",
      source: RASTER_SOURCE_ID,
      paint: {
        "raster-opacity": 1,
        "raster-saturation": 0.22,
        "raster-contrast": 0.12,
        "raster-brightness-min": 0.18,
        "raster-brightness-max": 0.98,
      },
    });
  }

  if (!map.getSource(LABEL_SOURCE_ID)) {
    map.addSource(LABEL_SOURCE_ID, {
      type: "raster",
      tiles: TIANDITU_LABEL_TILES,
      tileSize: 256,
      minzoom: 0,
      maxzoom: 20,
      attribution: TIANDITU_ATTRIBUTION,
    });
  }

  if (!map.getLayer(LABEL_LAYER_ID)) {
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "raster",
      source: LABEL_SOURCE_ID,
      paint: {
        "raster-opacity": 0.96,
      },
    });
  }
}

function ensureSiteSourceAndLayers(
  map: MapLibreMap,
  featureCollection: ReturnType<typeof toGlobalSiteFeatureCollection>,
) {
  const existingSource = map.getSource(SITE_SOURCE_ID) as GeoJSONSource | undefined;

  if (!existingSource) {
    map.addSource(SITE_SOURCE_ID, {
      type: "geojson",
      data: featureCollection,
    });
  } else {
    existingSource.setData(featureCollection);
  }

  if (!map.getLayer(SITE_HALO_LAYER_ID)) {
    map.addLayer({
      id: SITE_HALO_LAYER_ID,
      type: "circle",
      source: SITE_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          12,
          3,
          18,
          5,
          24,
        ],
        "circle-color": [
          "match",
          ["get", "status"],
          "warning",
          "#ffc400",
          "unconnected",
          "#94a3b8",
          "#34d3ff",
        ],
        "circle-opacity": 0.2,
        "circle-stroke-width": 0,
        "circle-blur": 0.12,
      },
    });
  }

  if (!map.getLayer(SITE_RING_LAYER_ID)) {
    map.addLayer({
      id: SITE_RING_LAYER_ID,
      type: "circle",
      source: SITE_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          7,
          3,
          9,
          5,
          11,
        ],
        "circle-color": "rgba(255,255,255,0)",
        "circle-stroke-color": [
          "match",
          ["get", "status"],
          "warning",
          "rgba(255,196,0,0.42)",
          "unconnected",
          "rgba(148,163,184,0.34)",
          "rgba(56,189,248,0.42)",
        ],
        "circle-stroke-width": 2,
        "circle-opacity": 1,
      },
    });
  }

  if (!map.getLayer(SITE_CORE_LAYER_ID)) {
    map.addLayer({
      id: SITE_CORE_LAYER_ID,
      type: "circle",
      source: SITE_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          3.2,
          3,
          4.1,
          5,
          4.8,
        ],
        "circle-color": [
          "match",
          ["get", "status"],
          "warning",
          "#ffc400",
          "unconnected",
          "#7c8ea0",
          "#0ea5e9",
        ],
        "circle-stroke-color": "rgba(255,255,255,0.95)",
        "circle-stroke-width": 2,
        "circle-opacity": 1,
      },
    });
  }
}

function ensurePlannedPlantSourceAndLayers(
  map: MapLibreMap,
  featureCollection: ReturnType<typeof toPlannedPlantFeatureCollection>,
) {
  const existingSource = map.getSource(PLANNED_SOURCE_ID) as GeoJSONSource | undefined;

  if (!existingSource) {
    map.addSource(PLANNED_SOURCE_ID, {
      type: "geojson",
      data: featureCollection,
    });
  } else {
    existingSource.setData(featureCollection);
  }

  if (!map.getLayer(PLANNED_HALO_LAYER_ID)) {
    map.addLayer({
      id: PLANNED_HALO_LAYER_ID,
      type: "circle",
      source: PLANNED_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          14,
          3,
          20,
          5,
          26,
        ],
        "circle-color": "#22c55e",
        "circle-opacity": 0.18,
        "circle-stroke-width": 0,
        "circle-blur": 0.1,
      },
    });
  }

  if (!map.getLayer(PLANNED_CORE_LAYER_ID)) {
    map.addLayer({
      id: PLANNED_CORE_LAYER_ID,
      type: "circle",
      source: PLANNED_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          4.4,
          3,
          5.4,
          5,
          6.4,
        ],
        "circle-color": "#16a34a",
        "circle-stroke-color": "rgba(255,255,255,0.96)",
        "circle-stroke-width": 2.2,
        "circle-opacity": 1,
      },
    });
  }
}

function applyMercatorViewport(map: MapLibreMap, points: GlobalSitePoint[]) {
  const bounds = getGlobalSiteBounds(points);

  if (!bounds) {
    return;
  }

  map.fitBounds(
    [
      [bounds.minLng, bounds.minLat],
      [bounds.maxLng, bounds.maxLat],
    ],
    {
      padding: {
        top: 88,
        right: 96,
        bottom: 88,
        left: 96,
      },
      duration: 900,
      maxZoom: 1.55,
      linear: true,
    },
  );
}

function applyGlobeViewport(map: MapLibreMap) {
  map.easeTo({
    center: DEFAULT_GLOBE_CENTER,
    zoom: DEFAULT_GLOBE_ZOOM,
    duration: 900,
    essential: true,
  });
}

function syncSceneBackground(map: MapLibreMap, mode: ViewMode) {
  map.setPaintProperty(
    "background",
    "background-color",
    mode === "globe" ? GLOBE_SCENE_BACKGROUND : LIGHT_SCENE_BACKGROUND,
  );
}

function applyViewMode(map: MapLibreMap, mode: ViewMode, points: GlobalSitePoint[]) {
  syncSceneBackground(map, mode);

  if (mode === "globe") {
    map.setMinZoom(GLOBE_MIN_ZOOM);
    map.setMaxZoom(GLOBE_MAX_ZOOM);
    map.setProjection({ type: "globe" });
    applyGlobeViewport(map);
    return;
  }

  map.setMinZoom(MERCATOR_MIN_ZOOM);
  map.setMaxZoom(MERCATOR_MAX_ZOOM);
  map.setProjection({ type: "mercator" });
  applyMercatorViewport(map, points);
}

export function GlobalMapScene({
  points,
  plannedPlants = [],
  anomalySiteId = null,
  inspectionBusy = false,
  abnormalWorkOrderStatus = "idle",
  onStartInspection,
  onOpenAnomalyReview,
  onOpenSiteDetail,
  onRequestTechnicalSupport,
}: GlobalMapSceneProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mapReadyRef = useRef(false);
  const selectedSiteRef = useRef<GlobalSitePoint | null>(null);
  const selectedPlannedPlantRef = useRef<PlannedPlant | null>(null);
  const anomalySiteRef = useRef<GlobalSitePoint | null>(null);
  const updatePopupLayoutRef = useRef<() => void>(() => {});
  const updateAnomalyLayoutRef = useRef<() => void>(() => {});

  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("globe");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedPlannedPlantId, setSelectedPlannedPlantId] = useState<string | null>(null);
  const [popupLayout, setPopupLayout] = useState<PopupLayout | null>(null);
  const [anomalyIndicatorLayout, setAnomalyIndicatorLayout] =
    useState<SiteIndicatorLayout | null>(null);

  const featureCollection = useMemo(
    () => toGlobalSiteFeatureCollection(points),
    [points],
  );
  const plannedPlantFeatureCollection = useMemo(
    () => toPlannedPlantFeatureCollection(plannedPlants),
    [plannedPlants],
  );

  const latestPointsRef = useRef(points);
  const latestFeatureCollectionRef = useRef(featureCollection);
  const latestPlannedPlantFeatureCollectionRef = useRef(
    plannedPlantFeatureCollection,
  );
  const latestViewModeRef = useRef<ViewMode>("globe");

  const siteById = useMemo(
    () => new Map(points.map((point) => [point.id, point])),
    [points],
  );
  const plannedPlantById = useMemo(
    () => new Map(plannedPlants.map((plant) => [plant.plantId, plant])),
    [plannedPlants],
  );

  const selectedSite = selectedSiteId ? siteById.get(selectedSiteId) ?? null : null;
  const selectedPlannedPlant = selectedPlannedPlantId
    ? plannedPlantById.get(selectedPlannedPlantId) ?? null
    : null;
  const anomalySite = anomalySiteId ? siteById.get(anomalySiteId) ?? null : null;
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 260 });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 260 });
  }, []);

  useEffect(() => {
    latestPointsRef.current = points;
  }, [points]);

  useEffect(() => {
    latestFeatureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    latestPlannedPlantFeatureCollectionRef.current = plannedPlantFeatureCollection;
  }, [plannedPlantFeatureCollection]);

  const plannedPlantByIdRef = useRef(plannedPlantById);

  useEffect(() => {
    plannedPlantByIdRef.current = plannedPlantById;
  }, [plannedPlantById]);

  useEffect(() => {
    latestViewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    selectedSiteRef.current = selectedSite;
  }, [selectedSite]);

  useEffect(() => {
    selectedPlannedPlantRef.current = selectedPlannedPlant;
  }, [selectedPlannedPlant]);

  useEffect(() => {
    anomalySiteRef.current = anomalySite;
  }, [anomalySite]);

  const openPlannedPlantPopup = useCallback(
    (plantId: string, anchorX?: number, anchorY?: number) => {
      const map = mapRef.current;
      const container = mapContainerRef.current;
      const plant = plannedPlantByIdRef.current.get(plantId);

      if (!map || !container || !plant) {
        return;
      }

      const projected = map.project([plant.lng, plant.lat]);

      setPopupLayout(
        resolveAnchoredPopupLayout({
          anchorX: anchorX ?? projected.x,
          anchorY: anchorY ?? projected.y,
          containerWidth: container.clientWidth,
          containerHeight: container.clientHeight,
          panelWidth: PANEL_WIDTH,
          panelHeight: PANEL_HEIGHT,
        }),
      );
      setSelectedSiteId(null);
      setSelectedPlannedPlantId(plantId);
    },
    [],
  );

  const updatePopupLayout = useCallback(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    const currentSelectedSite = selectedSiteRef.current;
    const currentSelectedPlannedPlant = selectedPlannedPlantRef.current;

    const target =
      currentSelectedPlannedPlant ?? currentSelectedSite;

    if (!map || !container || !target) {
      setPopupLayout(null);
      return;
    }

    const projected = map.project([target.lng, target.lat]);
    setPopupLayout(
      resolveAnchoredPopupLayout({
        anchorX: projected.x,
        anchorY: projected.y,
        containerWidth: container.clientWidth,
        containerHeight: container.clientHeight,
        panelWidth: PANEL_WIDTH,
        panelHeight: PANEL_HEIGHT,
      }),
    );
  }, []);

  useEffect(() => {
    updatePopupLayoutRef.current = updatePopupLayout;
  }, [updatePopupLayout]);

  const updateAnomalyIndicatorLayout = useCallback(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    const currentAnomalySite = anomalySiteRef.current;

    if (!map || !container || !currentAnomalySite) {
      setAnomalyIndicatorLayout(null);
      return;
    }

    const projected = map.project([currentAnomalySite.lng, currentAnomalySite.lat]);
    setAnomalyIndicatorLayout({
      left: Math.min(
        Math.max(projected.x + 10, 18),
        container.clientWidth - 24,
      ),
      top: Math.min(
        Math.max(projected.y - 24, 18),
        container.clientHeight - 24,
      ),
    });
  }, []);

  useEffect(() => {
    updateAnomalyLayoutRef.current = updateAnomalyIndicatorLayout;
  }, [updateAnomalyIndicatorLayout]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    ensureBasemapSourcesAndLayers(map);
    ensureSiteSourceAndLayers(map, featureCollection);
    ensurePlannedPlantSourceAndLayers(map, plannedPlantFeatureCollection);
    applyViewMode(map, viewMode, points);
  }, [featureCollection, plannedPlantFeatureCollection, points, viewMode]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      updatePopupLayoutRef.current();
      updateAnomalyLayoutRef.current();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [anomalySite, selectedPlannedPlant, selectedSite, viewMode]);

  useEffect(() => {
    const container = mapContainerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: BASE_MAP_STYLE,
      center: DEFAULT_GLOBE_CENTER,
      zoom: DEFAULT_GLOBE_ZOOM,
      attributionControl: false,
      dragPan: true,
      dragRotate: false,
      boxZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      touchPitch: false,
      pitchWithRotate: false,
      renderWorldCopies: false,
      maxPitch: 0,
    });

    map.scrollZoom.disable();
    map.touchZoomRotate.disable();
    map.scrollZoom.enable({
      around: "center",
    });
    map.scrollZoom.setWheelZoomRate(1 / 520);
    map.scrollZoom.setZoomRate(1 / 120);
    map.touchZoomRotate.enable();
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    const failTimer = window.setTimeout(() => {
      setMapStatus("failed");
      setFailureMessage(
        "地图引擎初始化失败，请检查浏览器 WebGL 或底图瓦片加载状态。",
      );
    }, 9000);

    const syncMap = () => {
      ensureBasemapSourcesAndLayers(map);
      ensureSiteSourceAndLayers(map, latestFeatureCollectionRef.current);
      ensurePlannedPlantSourceAndLayers(
        map,
        latestPlannedPlantFeatureCollectionRef.current,
      );
      applyViewMode(map, latestViewModeRef.current, latestPointsRef.current);
      window.clearTimeout(failTimer);
      mapReadyRef.current = true;
      setFailureMessage(null);
      setMapStatus("ready");
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const handleSiteClick = (
      event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const feature = event.features?.[0];
      const featureId = feature?.properties?.id;

      if (typeof featureId !== "string") {
        return;
      }

      setSelectedPlannedPlantId(null);
      setSelectedSiteId(featureId);
    };

    const handlePlannedPlantClick = (
      event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const feature = event.features?.[0];
      const plantId = feature?.properties?.plantId;

      if (typeof plantId !== "string") {
        return;
      }

      openPlannedPlantPopup(plantId, event.point.x, event.point.y);
    };

    const handleMove = () => {
      updatePopupLayoutRef.current();
      updateAnomalyLayoutRef.current();
    };

    const handleMapClick = (
      event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [
          PLANNED_HALO_LAYER_ID,
          PLANNED_CORE_LAYER_ID,
          SITE_HALO_LAYER_ID,
          SITE_RING_LAYER_ID,
          SITE_CORE_LAYER_ID,
        ],
      });
      const feature = features[0];
      const featureId = feature?.properties?.id;
      const plannedPlantId = feature?.properties?.plantId;

      if (typeof plannedPlantId === "string" || typeof featureId === "string") {
        return;
      }

      setSelectedSiteId(null);
      setSelectedPlannedPlantId(null);
    };

    const handleLoad = () => {
      syncMap();

      map.on("mouseenter", SITE_HALO_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", SITE_HALO_LAYER_ID, handleMouseLeave);
      map.on("click", SITE_HALO_LAYER_ID, handleSiteClick);
      map.on("mouseenter", PLANNED_HALO_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", PLANNED_HALO_LAYER_ID, handleMouseLeave);
      map.on("click", PLANNED_HALO_LAYER_ID, handlePlannedPlantClick);
      map.on("click", handleMapClick);
      map.on("move", handleMove);
      map.on("zoom", handleMove);
      map.on("resize", handleMove);
    };

    const handleError = () => {
      if (mapReadyRef.current) {
        return;
      }

      setFailureMessage("地图资源加载较慢，正在继续初始化全球底图。");
    };

    map.on("load", handleLoad);
    map.on("error", handleError);

    resizeObserverRef.current = new ResizeObserver(() => {
      map.resize();
      updatePopupLayoutRef.current();
      updateAnomalyLayoutRef.current();
    });

    resizeObserverRef.current.observe(container);

    return () => {
      window.clearTimeout(failTimer);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      map.getCanvas().style.cursor = "";
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.off("mouseenter", SITE_HALO_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", SITE_HALO_LAYER_ID, handleMouseLeave);
      map.off("click", SITE_HALO_LAYER_ID, handleSiteClick);
      map.off("mouseenter", PLANNED_HALO_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", PLANNED_HALO_LAYER_ID, handleMouseLeave);
      map.off("click", PLANNED_HALO_LAYER_ID, handlePlannedPlantClick);
      map.off("click", handleMapClick);
      map.off("move", handleMove);
      map.off("zoom", handleMove);
      map.off("resize", handleMove);
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [openPlannedPlantPopup]);

  return (
    <div
      className="relative h-full min-h-[620px] overflow-hidden rounded-[36px] border border-white/80 bg-[linear-gradient(180deg,#f8fcff_0%,#eaf5ff_42%,#dceeff_100%)] shadow-[0_36px_100px_rgba(107,162,196,0.18)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(255,255,255,0.92),transparent_22%),radial-gradient(circle_at_50%_46%,rgba(129,202,255,0.18),transparent_36%),radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.78),transparent_18%),radial-gradient(circle_at_84%_18%,rgba(159,220,255,0.36),transparent_14%),linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0)_24%,rgba(167,211,242,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-36px_80px_rgba(130,184,220,0.12)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[760px] max-w-[86vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.7),rgba(255,255,255,0.05)_58%,transparent_72%)] blur-2xl" />

      <div className="pointer-events-none absolute top-5 right-5 z-30 flex items-center gap-3">
        <div
          className="pointer-events-auto inline-flex rounded-full border border-white/90 bg-white/86 p-1 shadow-[0_16px_38px_rgba(107,162,196,0.14)] backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => setViewMode("globe")}
            className={`rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition ${
              viewMode === "globe"
                ? "bg-[linear-gradient(135deg,#0ea5e9,#38bdf8)] text-white shadow-[0_12px_26px_rgba(14,165,233,0.26)]"
                : "text-slate-600 hover:bg-sky-50 hover:text-slate-950"
            }`}
          >
            Globe
          </button>
          <button
            type="button"
            onClick={() => setViewMode("mercator")}
            className={`rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition ${
              viewMode === "mercator"
                ? "bg-[linear-gradient(135deg,#0ea5e9,#38bdf8)] text-white shadow-[0_12px_26px_rgba(14,165,233,0.26)]"
                : "text-slate-600 hover:bg-sky-50 hover:text-slate-950"
            }`}
          >
            2D
          </button>
        </div>

        <div className="rounded-full border border-white/90 bg-white/86 px-4 py-2 text-[11px] font-medium text-slate-600 shadow-[0_16px_34px_rgba(107,162,196,0.12)] backdrop-blur-xl">
          {viewMode === "globe"
            ? "Globe 模式用于全球态势感知"
            : "2D 模式用于经纬度精确核对"}
        </div>

        <div className="pointer-events-auto inline-flex overflow-hidden rounded-[20px] border border-white/90 bg-white/86 shadow-[0_16px_34px_rgba(107,162,196,0.12)] backdrop-blur-xl">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="放大地图"
            className="flex h-10 w-10 items-center justify-center text-xl font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-slate-950"
          >
            +
          </button>
          <div className="w-px bg-sky-100/90" />
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="缩小地图"
            className="flex h-10 w-10 items-center justify-center text-xl font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-slate-950"
          >
            -
          </button>
        </div>
      </div>

      <div className="relative z-10 h-full min-h-[620px] w-full" ref={mapContainerRef} />

      <div className="pointer-events-none absolute top-24 right-5 z-30">
        <AbnormalWorkOrderCard
          status={abnormalWorkOrderStatus}
          onRequestSupport={() => onRequestTechnicalSupport?.()}
        />
      </div>

      {selectedPlannedPlant && popupLayout ? (
        <div
          className="absolute z-30"
          style={{
            left: popupLayout.left,
            top: popupLayout.top,
            width: PANEL_WIDTH,
            transform:
              popupLayout.placement === "top"
                ? "translateY(calc(-100% - 16px))"
                : "translateY(16px)",
          }}
        >
          <PlannedPlantPopup
            plannedPlant={selectedPlannedPlant}
            onClose={() => setSelectedPlannedPlantId(null)}
          />
        </div>
      ) : null}

      {selectedSite && popupLayout && !selectedPlannedPlant ? (
        <div
          className="absolute z-30"
          style={{
            left: popupLayout.left,
            top: popupLayout.top,
            width: PANEL_WIDTH,
            transform:
              popupLayout.placement === "top"
                ? "translateY(calc(-100% - 16px))"
                : "translateY(16px)",
          }}
        >
          <SitePopupCard
            site={selectedSite}
            inspectionBusy={inspectionBusy}
            onClose={() => setSelectedSiteId(null)}
            onStartInspection={onStartInspection}
            onOpenAnomalyReview={onOpenAnomalyReview}
            onOpenSiteDetail={onOpenSiteDetail}
          />
        </div>
      ) : null}

      {anomalyIndicatorLayout ? (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: anomalyIndicatorLayout.left,
            top: anomalyIndicatorLayout.top,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="global-site-anomaly-indicator">
            <span className="global-site-anomaly-indicator-ping" />
            <span className="global-site-anomaly-indicator-core">!</span>
          </div>
        </div>
      ) : null}

      {mapStatus !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
          <div className="rounded-[26px] border border-white/75 bg-white/76 px-6 py-5 text-center shadow-[0_18px_50px_rgba(135,164,186,0.18)]">
            <p className="text-[11px] font-semibold tracking-[0.28em] text-sky-700/75 uppercase">
              {mapStatus === "failed" ? "地图降级提示" : "地图初始化中"}
            </p>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {mapStatus === "failed" ? "全球底图暂时不可用" : "正在加载全球底图"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
              {failureMessage ?? "正在初始化全球底图与站点图层，请稍候。"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
