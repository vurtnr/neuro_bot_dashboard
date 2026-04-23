"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RobotInspectionModal from "@/components/robot-inspection-modal";
import RobotPatrolLockCard from "@/components/robot-patrol-lock-card";
import RobotPatrolModal from "@/components/robot-patrol-modal";
import { getBatteryWebSocketUrl } from "@/lib/robot-inspection/config";
import { subscribeQinghaiSitePatrolEvents } from "@/lib/robot-inspection/site-patrol";
import { getResolvedWorkOrderNodeIds } from "@/lib/work-order-resolution";
import { useRobotInspection } from "@/lib/robot-inspection/use-robot-inspection";
import { useRobotPatrol } from "@/lib/robot-inspection/use-robot-patrol";
import { generateMinuteLevelData } from "@/utils";
import {
  appendBatteryTelemetryPoint,
  parseBatteryTelemetryMessage,
  type BatteryTelemetryPoint,
} from "./battery-telemetry";
import {
  reduceSitePatrolOverlayState,
  type SiteToastState,
} from "./site-patrol-overlay";
import SiteTopologyFlow from "./site-topology-flow";
import type {
  PatrolLockedDevice,
  RobotInspectionEvent,
} from "@/lib/robot-inspection/types";

type ThemeMode = "day" | "sunset";
type DeviceStatus = "normal" | "warning" | "fault" | "offline";
type BatteryConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

type CabinetMetrics = {
  temperature: number;
  soc: number;
  current: number;
  voltage: number;
};

type InverterCsvPoint = {
  timeLabel: string;
  sortKey: string;
  eday: number | null;
  pac: number | null;
  etotal: number | null;
};

type InverterCsvSeries = {
  source: string;
  points: InverterCsvPoint[];
};

type TopologyNodeData = {
  label: string;
  subtitle?: string;
  width?: number;
  height?: number;
  mode: ThemeMode;
  status?: DeviceStatus;
  hasWorkOrder?: boolean;
  metrics?: CabinetMetrics;
  disabled?: boolean;
  locked?: boolean;
  highlighted?: boolean;
};

const THEME = {
  day: {
    shell: "from-slate-100 via-cyan-50 to-blue-100",
    panel: "border-sky-200/80 bg-white/80",
    panelShadow: "shadow-[0_16px_40px_rgba(14,116,144,0.12)]",
    textMain: "text-slate-800",
    textSub: "text-slate-600",
    accent: "text-sky-700",
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    flowBg: "#eef7ff",
    flowGrid: "rgba(14,116,144,0.16)",
    flowEdge: "#38bdf8",
    ncuBg: "#e0f2fe",
    ncuBorder: "#38bdf8",
    cabinetBg: "#dbeafe",
    cabinetBorder: "#3b82f6",
    frameBg: "rgba(14,165,233,0.08)",
    frameBorder: "rgba(14,165,233,0.5)",
    hubBg: "#cffafe",
    hubBorder: "#06b6d4",
  },
  sunset: {
    shell: "from-orange-50 via-amber-50 to-rose-100",
    panel: "border-orange-200/75 bg-white/82",
    panelShadow: "shadow-[0_16px_40px_rgba(194,65,12,0.12)]",
    textMain: "text-slate-800",
    textSub: "text-slate-600",
    accent: "text-orange-700",
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    flowBg: "#fff5eb",
    flowGrid: "rgba(249,115,22,0.2)",
    flowEdge: "#f97316",
    ncuBg: "#ffedd5",
    ncuBorder: "#fb923c",
    cabinetBg: "#fee2e2",
    cabinetBorder: "#f97316",
    frameBg: "rgba(249,115,22,0.08)",
    frameBorder: "rgba(249,115,22,0.5)",
    hubBg: "#fed7aa",
    hubBorder: "#f97316",
  },
};

const STATUS_COLORS: Record<
  DeviceStatus,
  { background: string; border: string; text: string }
> = {
  normal: {
    background: "#dcfce7",
    border: "#22c55e",
    text: "#166534",
  },
  warning: {
    background: "#ffedd5",
    border: "#f97316",
    text: "#9a3412",
  },
  fault: {
    background: "#fee2e2",
    border: "#ef4444",
    text: "#991b1b",
  },
  offline: {
    background: "#e5e7eb",
    border: "#9ca3af",
    text: "#374151",
  },
};

const STATUS_LABELS: Record<DeviceStatus, string> = {
  normal: "正常",
  warning: "告警",
  fault: "异常",
  offline: "离线",
};

const STATUS_ORDER: DeviceStatus[] = ["normal", "warning", "fault", "offline"];
const DEVICE_DETAIL_ID = "inverter-b";

function parseInspectionAngles(event: RobotInspectionEvent): {
  actualAngle: number;
  targetAngle: number;
} | null {
  if (
    typeof event.actualAngle === "number" &&
    Number.isFinite(event.actualAngle) &&
    typeof event.targetAngle === "number" &&
    Number.isFinite(event.targetAngle)
  ) {
    return {
      actualAngle: event.actualAngle,
      targetAngle: event.targetAngle,
    };
  }

  const message = event.message ?? "";
  const matched = message.match(
    /actual_angle=(-?\d+(?:\.\d+)?)\s+target_angle=(-?\d+(?:\.\d+)?)/,
  );
  if (!matched) {
    return null;
  }

  const actualAngle = Number(matched[1]);
  const targetAngle = Number(matched[2]);
  if (!Number.isFinite(actualAngle) || !Number.isFinite(targetAngle)) {
    return null;
  }

  return {
    actualAngle,
    targetAngle,
  };
}

function seededShuffle<T>(list: T[], seed = 20260309): T[] {
  const result = [...list];
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function parseNullableCsvNumber(value: string | undefined): number | null {
  if (!value || value === "\\N") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimeLabel(timestamp: string | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  const [, timePart] = timestamp.trim().split(" ");
  if (!timePart) {
    return null;
  }

  return timePart.slice(0, 5);
}

function parseInverterCsv(text: string, source: string): InverterCsvSeries {
  const [headerLine, ...rawLines] = text.trim().split(/\r?\n/);
  const headers = headerLine.replace(/^\uFEFF/, "").split(",");
  const indexMap = new Map(headers.map((header, index) => [header, index]));

  const createtimeIndex = indexMap.get("createtime");
  const edayIndex = indexMap.get("eday");
  const pacIndex = indexMap.get("pac");
  const etotalIndex = indexMap.get("etotal");

  if (
    createtimeIndex === undefined ||
    edayIndex === undefined ||
    pacIndex === undefined ||
    etotalIndex === undefined
  ) {
    throw new Error(`CSV ${source} is missing required inverter fields`);
  }

  const points = rawLines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(","))
    .map((columns) => {
      const sortKey = columns[createtimeIndex]?.trim() ?? "";
      const timeLabel = formatTimeLabel(sortKey);
      if (!timeLabel) {
        return null;
      }

      return {
        timeLabel,
        sortKey,
        eday: parseNullableCsvNumber(columns[edayIndex]),
        pac: parseNullableCsvNumber(columns[pacIndex]),
        etotal: parseNullableCsvNumber(columns[etotalIndex]),
      } satisfies InverterCsvPoint;
    })
    .filter((point): point is InverterCsvPoint => point !== null)
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey));

  return { source, points };
}

function createPvStatusPool(total: number): DeviceStatus[] {
  const ratios: Array<[DeviceStatus, number]> = [
    ["normal", 0.9],
    ["fault", 0.01],
    ["warning", 0.05],
    ["offline", 0.04],
  ];

  const countByStatus: Record<DeviceStatus, number> = {
    normal: 0,
    warning: 0,
    fault: 0,
    offline: 0,
  };

  const withRemainder = ratios.map(([status, ratio]) => {
    const raw = total * ratio;
    const count = Math.floor(raw);
    countByStatus[status] = count;
    return { status, remainder: raw - count };
  });

  const remaining =
    total - Object.values(countByStatus).reduce((sum, count) => sum + count, 0);
  withRemainder
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((item, index) => {
      if (index < remaining) {
        countByStatus[item.status] += 1;
      }
    });

  const pool: DeviceStatus[] = [];
  (Object.keys(countByStatus) as DeviceStatus[]).forEach((status) => {
    for (let i = 0; i < countByStatus[status]; i += 1) {
      pool.push(status);
    }
  });
  return seededShuffle(pool);
}

function createPvRuntimeData(total: number) {
  return createPvStatusPool(total).map((status) => ({
    status,
    hasWorkOrder: false,
  }));
}

function deriveCabinetStatus(metrics: CabinetMetrics): DeviceStatus {
  const currentAbs = Math.abs(metrics.current);
  if (metrics.voltage <= 460 || (metrics.soc <= 4 && currentAbs <= 5)) {
    return "offline";
  }
  if (
    metrics.temperature >= 82 ||
    currentAbs >= 190 ||
    metrics.voltage >= 860 ||
    metrics.voltage < 520
  ) {
    return "fault";
  }
  if (
    metrics.temperature >= 65 ||
    metrics.soc < 20 ||
    currentAbs >= 140 ||
    metrics.voltage >= 820 ||
    metrics.voltage < 560
  ) {
    return "warning";
  }
  return "normal";
}

function createCabinetRuntimeData() {
  const metricsList: CabinetMetrics[] = [
    { temperature: 41, soc: 71, current: 82, voltage: 724 },
    { temperature: 44, soc: 66, current: 90, voltage: 718 },
    { temperature: 68, soc: 58, current: 148, voltage: 812 },
    { temperature: 39, soc: 74, current: 76, voltage: 732 },
    { temperature: 84, soc: 52, current: 196, voltage: 844 },
    { temperature: 36, soc: 79, current: 61, voltage: 739 },
    { temperature: 59, soc: 22, current: 132, voltage: 565 },
    { temperature: 42, soc: 69, current: 88, voltage: 726 },
    { temperature: 28, soc: 3, current: 0, voltage: 452 },
    { temperature: 45, soc: 64, current: 102, voltage: 714 },
  ];

  return metricsList.map((metrics) => {
    const status = deriveCabinetStatus(metrics);
    return { metrics, status, hasWorkOrder: false };
  });
}

function getTemperaturePalette(temperature: number) {
  if (temperature > 80) {
    return {
      background: "rgba(239,68,68,0.16)",
      border: "rgba(239,68,68,0.48)",
      text: "#b91c1c",
    };
  }
  if (temperature >= 60) {
    return {
      background: "rgba(249,115,22,0.16)",
      border: "rgba(249,115,22,0.48)",
      text: "#c2410c",
    };
  }
  if (temperature >= 30) {
    return {
      background: "rgba(234,179,8,0.18)",
      border: "rgba(202,138,4,0.45)",
      text: "#854d0e",
    };
  }
  return {
    background: "rgba(59,130,246,0.16)",
    border: "rgba(37,99,235,0.45)",
    text: "#1d4ed8",
  };
}

function getTemperatureColor(temperature: number) {
  if (temperature > 80) return "#ef4444";
  if (temperature >= 60) return "#f97316";
  if (temperature >= 30) return "#eab308";
  return "#3b82f6";
}

function WorkOrderBadge() {
  return (
    <span className="pointer-events-none absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-red-200 bg-red-500 px-1 text-[9px] font-semibold leading-none text-white shadow-sm">
      工
    </span>
  );
}

function createTrendOptions({
  title,
  unit,
  color,
  data,
  categories,
  mode,
  height,
}: {
  title: string;
  unit: string;
  color: string;
  data: number[];
  categories: string[];
  mode: ThemeMode;
  height: number;
}): Highcharts.Options {
  const isDay = mode === "day";
  const midIndex = Math.floor(categories.length / 2);

  return {
    chart: {
      type: "areaspline",
      height,
      backgroundColor: "transparent",
      spacing: [8, 8, 8, 8],
      animation: false,
    },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      categories,
      tickPositions: [0, midIndex, categories.length - 1],
      tickLength: 0,
      lineColor: isDay ? "rgba(100,116,139,0.3)" : "rgba(217,119,6,0.28)",
      labels: {
        style: {
          color: isDay ? "#475569" : "#9a3412",
          fontSize: "10px",
        },
      },
    },
    yAxis: {
      title: { text: undefined },
      gridLineDashStyle: "ShortDash",
      gridLineColor: isDay ? "rgba(100,116,139,0.2)" : "rgba(217,119,6,0.18)",
      labels: {
        style: {
          color: isDay ? "#64748b" : "#9a3412",
          fontSize: "10px",
        },
      },
    },
    tooltip: {
      shared: true,
      backgroundColor: isDay
        ? "rgba(255,255,255,0.95)"
        : "rgba(255,247,237,0.95)",
      borderColor: isDay ? "rgba(14,116,144,0.35)" : "rgba(249,115,22,0.35)",
      valueSuffix: ` ${unit}`,
    },
    plotOptions: {
      areaspline: {
        lineWidth: 2.2,
        marker: { enabled: false },
        fillOpacity: 0.24,
      },
    },
    series: [{ type: "areaspline", name: title, data, color }],
  };
}

function getBatteryConnectionLabel(state: BatteryConnectionState) {
  switch (state) {
    case "connected":
      return "实时流已连接";
    case "reconnecting":
      return "实时流重连中";
    case "error":
      return "实时流异常";
    default:
      return "实时流连接中";
  }
}

function createBatteryRealtimeOptions({
  points,
  mode,
  connectionState,
}: {
  points: BatteryTelemetryPoint[];
  mode: ThemeMode;
  connectionState: BatteryConnectionState;
}): Highcharts.Options {
  const isDay = mode === "day";
  const categories = points.map((point) => point.timeLabel);
  const tickPositions =
    categories.length > 1
      ? Array.from(
          new Set([0, Math.floor((categories.length - 1) / 2), categories.length - 1]),
        )
      : [];
  const latestPoint = points.at(-1);
  const statusLabel = latestPoint
    ? latestPoint.isCharging
      ? "充电中"
      : latestPoint.isDischarging
        ? "放电中"
        : latestPoint.status
    : "等待数据";
  const subtitleText = `${getBatteryConnectionLabel(connectionState)}<br/>${
    latestPoint ? `最新采样 ${latestPoint.timeLabel} · ${statusLabel}` : "最近 5 分钟滚动窗口"
  }`;

  return {
    chart: {
      type: "line",
      height: 260,
      backgroundColor: "transparent",
      spacing: [10, 8, 8, 8],
      animation: false,
    },
    title: { text: undefined },
    subtitle: {
      text: subtitleText,
      useHTML: true,
      align: "left",
      verticalAlign: "top",
      y: 4,
      style: {
        color: isDay ? "#64748b" : "#9a3412",
        fontSize: "11px",
        lineHeight: "16px",
      },
    },
    credits: { enabled: false },
    legend: {
      enabled: true,
      align: "center",
      verticalAlign: "bottom",
      itemStyle: {
        color: isDay ? "#334155" : "#7c2d12",
        fontSize: "10px",
        fontWeight: "500",
      },
      symbolRadius: 2,
      symbolWidth: 14,
    },
    xAxis: {
      categories,
      tickPositions,
      tickLength: 0,
      lineColor: isDay ? "rgba(148,163,184,0.35)" : "rgba(251,146,60,0.32)",
      labels: {
        style: {
          color: isDay ? "#64748b" : "#9a3412",
          fontSize: "10px",
        },
      },
    },
    yAxis: [
      {
        top: "0%",
        height: "42%",
        min: 0,
        max: 100,
        title: {
          text: "SOC",
          style: {
            color: isDay ? "#16a34a" : "#ea580c",
            fontSize: "10px",
          },
        },
        gridLineColor: isDay
          ? "rgba(100,116,139,0.14)"
          : "rgba(217,119,6,0.16)",
        labels: {
          format: "{value}%",
          style: {
            color: isDay ? "#64748b" : "#9a3412",
            fontSize: "10px",
          },
        },
      },
      {
        top: "0%",
        height: "42%",
        opposite: true,
        title: {
          text: "功率",
          style: {
            color: isDay ? "#0284c7" : "#f97316",
            fontSize: "10px",
          },
        },
        gridLineWidth: 0,
        labels: {
          style: {
            color: isDay ? "#64748b" : "#9a3412",
            fontSize: "10px",
          },
        },
      },
      {
        top: "50%",
        height: "20%",
        offset: 0,
        title: {
          text: "电压",
          style: {
            color: isDay ? "#6366f1" : "#d97706",
            fontSize: "10px",
          },
        },
        gridLineColor: isDay
          ? "rgba(129,140,248,0.12)"
          : "rgba(245,158,11,0.16)",
        labels: {
          style: {
            color: isDay ? "#64748b" : "#9a3412",
            fontSize: "10px",
          },
        },
      },
      {
        top: "76%",
        height: "18%",
        offset: 0,
        title: {
          text: "温度",
          style: {
            color: isDay ? "#f97316" : "#ea580c",
            fontSize: "10px",
          },
        },
        gridLineColor: isDay
          ? "rgba(251,146,60,0.12)"
          : "rgba(234,88,12,0.16)",
        labels: {
          style: {
            color: isDay ? "#64748b" : "#9a3412",
            fontSize: "10px",
          },
        },
      },
    ],
    tooltip: {
      shared: true,
      backgroundColor: isDay
        ? "rgba(255,255,255,0.96)"
        : "rgba(255,247,237,0.96)",
      borderColor: isDay
        ? "rgba(14,116,144,0.28)"
        : "rgba(249,115,22,0.28)",
      shadow: false,
    },
    plotOptions: {
      series: {
        animation: false,
        marker: {
          enabled: false,
        },
        states: {
          hover: {
            lineWidthPlus: 0,
          },
        },
      },
      areaspline: {
        fillOpacity: 0.18,
      },
    },
    series: [
      {
        type: "spline",
        name: "SOC (%)",
        data: points.map((point) => point.soc),
        yAxis: 0,
        color: isDay ? "#22c55e" : "#ea580c",
        lineWidth: 2.6,
        zIndex: 5,
      },
      {
        type: "areaspline",
        name: "有功功率",
        data: points.map((point) =>
          point.isCharging && !point.isDischarging
            ? -point.activePower
            : point.activePower,
        ),
        yAxis: 1,
        color: isDay ? "rgba(14,165,233,0.86)" : "rgba(249,115,22,0.82)",
        lineWidth: 2,
        zIndex: 4,
      },
      {
        type: "line",
        name: "最高电压 (V)",
        data: points.map((point) => point.maxVoltage),
        yAxis: 2,
        color: isDay ? "#6366f1" : "#d97706",
        lineWidth: 1.8,
      },
      {
        type: "line",
        name: "最低电压 (V)",
        data: points.map((point) => point.minVoltage),
        yAxis: 2,
        color: isDay ? "#a5b4fc" : "#fdba74",
        lineWidth: 1.6,
        dashStyle: "ShortDash",
      },
      {
        type: "line",
        name: "最高温度 (°C)",
        data: points.map((point) => point.maxTemp),
        yAxis: 3,
        color: isDay ? "#f97316" : "#ea580c",
        lineWidth: 1.8,
      },
      {
        type: "line",
        name: "最低温度 (°C)",
        data: points.map((point) => point.minTemp),
        yAxis: 3,
        color: isDay ? "#fdba74" : "#fb923c",
        lineWidth: 1.6,
        dashStyle: "ShortDash",
      },
    ],
  };
}

function NcuNode({ data }: NodeProps<Node<TopologyNodeData>>) {
  const status = data.status ?? "normal";
  const palette = STATUS_COLORS[status];
  const disabled = Boolean(data.disabled);
  const locked = Boolean(data.locked);
  const highlighted = Boolean(data.highlighted);

  return (
    <div
      className="relative flex h-[38px] w-[72px] items-center justify-center rounded-md text-[11px] font-semibold transition"
      style={{
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        boxShadow: highlighted
          ? "0 0 0 3px rgba(239,68,68,0.28), 0 0 0 1px rgba(255,255,255,0.72) inset, 0 0 24px rgba(239,68,68,0.24)"
          : locked
            ? "0 0 0 2px rgba(14,165,233,0.35), 0 0 0 1px rgba(255,255,255,0.65) inset"
            : `0 0 0 1px rgba(255,255,255,0.65) inset`,
        opacity: disabled ? 0.42 : 1,
        transform: highlighted
          ? "translateY(-1px) scale(1.03)"
          : locked
            ? "translateY(-1px)"
            : undefined,
      }}
    >
      {data.label}
      {data.hasWorkOrder ? <WorkOrderBadge /> : null}
      {locked ? (
        <span className="absolute -top-2 -right-2 rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-700">
          锁定
        </span>
      ) : null}
    </div>
  );
}

function CabinetNode({ data }: NodeProps<Node<TopologyNodeData>>) {
  const status = data.status ?? "normal";
  const palette = STATUS_COLORS[status];
  const disabled = Boolean(data.disabled);
  const locked = Boolean(data.locked);
  const highlighted = Boolean(data.highlighted);

  return (
    <div
      className="relative flex h-[64px] w-[132px] flex-col justify-center rounded-lg px-2 transition"
      style={{
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        boxShadow: highlighted
          ? "0 0 0 3px rgba(239,68,68,0.24), 0 12px 28px rgba(239,68,68,0.18)"
          : locked
            ? "0 0 0 2px rgba(14,165,233,0.3), 0 12px 22px rgba(15,23,42,0.12)"
            : `0 8px 18px rgba(15,23,42,0.08)`,
        opacity: disabled ? 0.42 : 1,
        transform: highlighted
          ? "translateY(-1px) scale(1.02)"
          : locked
            ? "translateY(-1px)"
            : undefined,
      }}
    >
      <Handle
        type="target"
        id="top"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <span className="text-[11px] font-semibold leading-tight">
        {data.label}
      </span>
      <span className="text-[10px] opacity-80">
        {data.subtitle ?? "储能电柜"}
      </span>
      {data.hasWorkOrder ? <WorkOrderBadge /> : null}
      {locked ? (
        <span className="absolute -top-2 right-2 rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-700">
          锁定
        </span>
      ) : null}
    </div>
  );
}

function FrameNode({ data }: NodeProps<Node<TopologyNodeData>>) {
  const palette = THEME[data.mode];

  return (
    <div
      className="pointer-events-none relative rounded-xl"
      style={{
        width: data.width,
        height: data.height,
        background: palette.frameBg,
        border: `1px dashed ${palette.frameBorder}`,
      }}
    >
      <div
        className="absolute top-2 left-3 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: palette.hubBg,
          border: `1px solid ${palette.hubBorder}`,
          color: "#334155",
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

function HubNode({ data }: NodeProps<Node<TopologyNodeData>>) {
  const palette = THEME[data.mode];
  const hasLabel = Boolean(data.label?.trim());

  return (
    <div
      className={
        hasLabel
          ? "relative rounded-md px-2 py-1 text-[10px] font-semibold text-slate-700"
          : "relative h-2 w-2 opacity-0"
      }
      style={
        hasLabel
          ? {
              background: palette.hubBg,
              border: `1px solid ${palette.hubBorder}`,
            }
          : undefined
      }
    >
      <Handle
        type="source"
        id="top"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <Handle
        type="source"
        id="left"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <Handle
        type="target"
        id="top"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <Handle
        type="target"
        id="bottom"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      <Handle
        type="target"
        id="right"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          background: "transparent",
          border: 0,
          pointerEvents: "none",
        }}
      />
      {hasLabel ? data.label : null}
    </div>
  );
}

const nodeTypes = {
  ncu: NcuNode,
  cabinet: CabinetNode,
  frame: FrameNode,
  hub: HubNode,
};

interface Site2DDashboardData {
  siteName: string;
  location: string;
  capacity: string;
  weather: string;
  hasWarning: boolean;
  pvPowerMw: number;
  storagePowerMw: number;
  loadPowerMw: number;
  gridPowerMw: number;
  treeEquivalent: number;
  co2ReductionTons: number;
  arbitrageIncome: number;
}

export default function SiteTopology2D({
  dashboardData,
}: {
  dashboardData: Site2DDashboardData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { beginInspection, closeDialog, retryPermission, dialogState } =
    useRobotInspection();
  const routeParams = useParams<{ siteId: string }>();
  const siteId = routeParams.siteId;
  const reviewNodeId = searchParams.get("reviewNodeId");
  const {
    patrolState,
    startPatrol,
    dismissPatrolError,
    isPatrolSupported,
    unsupportedPatrolMessage,
  } = useRobotPatrol(siteId);
  const [inverterSeries, setInverterSeries] = useState<InverterCsvSeries[]>([]);
  const [inverterSeriesError, setInverterSeriesError] = useState<string | null>(
    null,
  );
  const [topologyView, setTopologyView] = useState<"2d" | "3d">("2d");
  const [isTopologyFullscreen, setIsTopologyFullscreen] = useState(false);
  const [ncuPanelOpen, setNcuPanelOpen] = useState(true);
  const [cabinetPanelOpen, setCabinetPanelOpen] = useState(true);
  const [blockedNodeMessage, setBlockedNodeMessage] = useState("");
  const [siteToast, setSiteToast] = useState<SiteToastState | null>(null);
  const [batteryTelemetryHistory, setBatteryTelemetryHistory] = useState<
    BatteryTelemetryPoint[]
  >([]);
  const [batteryConnectionState, setBatteryConnectionState] =
    useState<BatteryConnectionState>("connecting");
  const [simulatedReviewNodeId, setSimulatedReviewNodeId] = useState<
    string | null
  >(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [resolvedWorkOrderNodeIds, setResolvedWorkOrderNodeIds] = useState<
    string[]
  >([]);
  const topologyPanelRef = useRef<HTMLElement | null>(null);
  const blockedNodeTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const siteToastRef = useRef<SiteToastState | null>(null);
  const simulatedReviewNodeIdRef = useRef<string | null>(null);
  const highlightedNodeIdRef = useRef<string | null>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<
    Node<TopologyNodeData>,
    Edge
  > | null>(null);
  const pageTheme = THEME.day;
  const topologyTheme = THEME.day;
  const lockedDevice = patrolState.lockedDevice;
  const lockedNodeId = lockedDevice?.nodeId ?? null;
  const patrolModalOpen =
    patrolState.status === "starting" ||
    patrolState.status === "dispatching" ||
    (patrolState.status === "error" && !lockedDevice);
  const patrolModalLoading =
    patrolState.status === "starting" || patrolState.status === "dispatching";
  const resolvedWorkOrderNodeIdSet = useMemo(
    () => new Set(resolvedWorkOrderNodeIds),
    [resolvedWorkOrderNodeIds],
  );
  const activeReviewNodeId = reviewNodeId ?? simulatedReviewNodeId;
  const basePvRuntimeData = useMemo(() => createPvRuntimeData(155), []);
  const baseCabinetRuntimeData = useMemo(() => createCabinetRuntimeData(), []);
  const pvRuntimeData = useMemo(
    () =>
      basePvRuntimeData.map((item, index) => ({
        ...item,
        hasWorkOrder: activeReviewNodeId
          ? `ncu-${index + 1}` === activeReviewNodeId &&
            !resolvedWorkOrderNodeIdSet.has(`ncu-${index + 1}`)
          : false,
      })),
    [activeReviewNodeId, basePvRuntimeData, resolvedWorkOrderNodeIdSet],
  );
  const cabinetRuntimeData = useMemo(
    () =>
      baseCabinetRuntimeData.map((item, index) => ({
        ...item,
        hasWorkOrder: activeReviewNodeId
          ? `cabinet-${index + 1}` === activeReviewNodeId &&
            !resolvedWorkOrderNodeIdSet.has(`cabinet-${index + 1}`)
          : false,
      })),
    [activeReviewNodeId, baseCabinetRuntimeData, resolvedWorkOrderNodeIdSet],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInverterSeries = async () => {
      try {
        const [inverter1Response, inverter2Response] = await Promise.all([
          fetch("/inverter1.csv"),
          fetch("/inverter2.csv"),
        ]);

        if (!inverter1Response.ok || !inverter2Response.ok) {
          throw new Error("failed_to_load_inverter_csv");
        }

        const [inverter1Text, inverter2Text] = await Promise.all([
          inverter1Response.text(),
          inverter2Response.text(),
        ]);

        if (cancelled) {
          return;
        }

        setInverterSeries([
          parseInverterCsv(inverter1Text, "逆变器 1"),
          parseInverterCsv(inverter2Text, "逆变器 2"),
        ]);
        setInverterSeriesError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("[site-2d] failed to load inverter csv data", error);
        setInverterSeries([]);
        setInverterSeriesError("逆变器发电数据加载失败");
      }
    };

    void loadInverterSeries();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncResolvedWorkOrders = () => {
      setResolvedWorkOrderNodeIds(getResolvedWorkOrderNodeIds(siteId));
    };

    syncResolvedWorkOrders();
    window.addEventListener("focus", syncResolvedWorkOrders);
    window.addEventListener("pageshow", syncResolvedWorkOrders);

    return () => {
      window.removeEventListener("focus", syncResolvedWorkOrders);
      window.removeEventListener("pageshow", syncResolvedWorkOrders);
    };
  }, [siteId]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsTopologyFullscreen(
        document.fullscreenElement === topologyPanelRef.current,
      );
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(
    () => () => {
      if (blockedNodeTimerRef.current !== null) {
        window.clearTimeout(blockedNodeTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    siteToastRef.current = siteToast;
  }, [siteToast]);

  useEffect(() => {
    simulatedReviewNodeIdRef.current = simulatedReviewNodeId;
  }, [simulatedReviewNodeId]);

  useEffect(() => {
    highlightedNodeIdRef.current = highlightedNodeId;
  }, [highlightedNodeId]);

  useEffect(() => {
    const socketUrl = getBatteryWebSocketUrl();
    if (!socketUrl) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let manuallyClosed = false;

    const connect = () => {
      if (manuallyClosed) {
        return;
      }

      setBatteryConnectionState(
        reconnectAttempt === 0 ? "connecting" : "reconnecting",
      );

      socket = new WebSocket(socketUrl);

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        setBatteryConnectionState("connected");
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        const nextPoint = parseBatteryTelemetryMessage(event.data);
        if (!nextPoint) {
          return;
        }

        setBatteryTelemetryHistory((current) =>
          appendBatteryTelemetryPoint(current, nextPoint),
        );
      });

      socket.addEventListener("error", () => {
        setBatteryConnectionState("error");
      });

      socket.addEventListener("close", () => {
        if (manuallyClosed) {
          return;
        }

        setBatteryConnectionState("reconnecting");
        const delay = Math.min(1000 * 2 ** reconnectAttempt, 10_000);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, delay);
      });
    };

    connect();

    return () => {
      manuallyClosed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, []);

  useEffect(() => {
    const pushSiteToast = (nextToast: SiteToastState) => {
      setSiteToast(nextToast);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setSiteToast(null);
        toastTimerRef.current = null;
      }, 4200);
    };

    const clearSiteToast = () => {
      setSiteToast(null);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };

    const applyPatrolEvent = (event: RobotInspectionEvent) => {
      const currentOverlayState = {
        siteToast: siteToastRef.current,
        simulatedReviewNodeId: simulatedReviewNodeIdRef.current,
        highlightedNodeId: highlightedNodeIdRef.current,
      };
      const nextOverlayState = reduceSitePatrolOverlayState(
        currentOverlayState,
        event,
        siteId,
      );

      if (nextOverlayState === currentOverlayState) {
        return;
      }

      setSimulatedReviewNodeId(nextOverlayState.simulatedReviewNodeId);
      setHighlightedNodeId(nextOverlayState.highlightedNodeId);

      if (nextOverlayState.siteToast) {
        pushSiteToast(nextOverlayState.siteToast);
      } else {
        clearSiteToast();
      }
    };

    const eventSource = subscribeQinghaiSitePatrolEvents(
      applyPatrolEvent,
      () => {
        pushSiteToast({
          tone: "critical",
          message: "机器人巡检事件通道已断开，请检查桥接服务连接。",
        });
      },
    );

    return () => {
      eventSource.close();
    };
  }, [siteId]);

  const toggleTopologyFullscreen = async () => {
    const panel = topologyPanelRef.current;
    if (!panel) {
      return;
    }

    if (document.fullscreenElement === panel) {
      await document.exitFullscreen();
      return;
    }

    if (!document.fullscreenElement) {
      await panel.requestFullscreen();
    }
  };

  const showTopologyTip = (message: string) => {
    setBlockedNodeMessage(message);
    if (blockedNodeTimerRef.current !== null) {
      window.clearTimeout(blockedNodeTimerRef.current);
    }
    blockedNodeTimerRef.current = window.setTimeout(() => {
      setBlockedNodeMessage("");
      blockedNodeTimerRef.current = null;
    }, 2200);
  };

  const ncuOverview = useMemo(() => {
    const counts: Record<DeviceStatus, number> = {
      normal: 0,
      warning: 0,
      fault: 0,
      offline: 0,
    };
    let workOrderTotal = 0;

    pvRuntimeData.forEach((item) => {
      counts[item.status] += 1;
      if (item.hasWorkOrder) {
        workOrderTotal += 1;
      }
    });

    return { counts, workOrderTotal };
  }, [pvRuntimeData]);

  const minuteData = useMemo(() => generateMinuteLevelData(), []);
  const sampledData = useMemo(
    () =>
      minuteData.filter(
        (_, index) => index % 12 === 0 || index === minuteData.length - 1,
      ),
    [minuteData],
  );

  const categories = useMemo(
    () => sampledData.map((point) => point.time),
    [sampledData],
  );
  const irradianceSeries = useMemo(
    () => sampledData.map((point) => point.irradiance),
    [sampledData],
  );
  const windSeries = useMemo(
    () => sampledData.map((point) => point.windSpeed),
    [sampledData],
  );
  const generationSeries = useMemo(
    () =>
      sampledData.map((point, index) => {
        const modulation = 0.93 + 0.07 * Math.sin(index / 5);
        return Number(
          (Math.max(0, point.irradiance) * 0.062 * modulation).toFixed(2),
        );
      }),
    [sampledData],
  );

  const isDay = true;
  const chargePower = Math.max(
    0,
    Number(dashboardData.storagePowerMw.toFixed(2)),
  );
  const dischargePower = Math.max(
    0,
    Number(Math.abs(Math.min(0, dashboardData.storagePowerMw)).toFixed(2)),
  );
  const socValue = useMemo(() => {
    const base =
      62 +
      dashboardData.pvPowerMw * 1.8 -
      Math.abs(dashboardData.storagePowerMw) * 2.6;
    return Number(Math.max(22, Math.min(95, base)).toFixed(1));
  }, [dashboardData.pvPowerMw, dashboardData.storagePowerMw]);
  const loadComposition = useMemo(() => {
    const total = Math.max(1, dashboardData.loadPowerMw);
    const production = Number((total * 0.58).toFixed(2));
    const process = Number((total * 0.27).toFixed(2));
    const station = Number((total - production - process).toFixed(2));
    return { production, process, station };
  }, [dashboardData.loadPowerMw]);
  const inverterOnlineRate = dashboardData.hasWarning ? 95.1 : 99.2;
  const batteryClusterOnlineRate = dashboardData.hasWarning ? 93.7 : 98.3;

  const overviewCards = useMemo(
    () => [
      {
        label: "光伏功率",
        value: `${dashboardData.pvPowerMw.toFixed(2)} MW`,
        icon: "☀",
      },
      {
        label: "储能功率",
        value: `${dashboardData.storagePowerMw >= 0 ? "充电" : "放电"} ${Math.abs(dashboardData.storagePowerMw).toFixed(2)} MW`,
        icon: "↻",
      },
      {
        label: "负载功率",
        value: `${dashboardData.loadPowerMw.toFixed(2)} MW`,
        icon: "⌁",
      },
      {
        label: "并网/馈电",
        value: `${dashboardData.gridPowerMw >= 0 ? "并网" : "馈电"} ${Math.abs(dashboardData.gridPowerMw).toFixed(2)} MW`,
        icon: "⇆",
      },
      {
        label: "减排二氧化碳",
        value: `${dashboardData.co2ReductionTons.toFixed(2)} 吨`,
        icon: "♻",
      },
      {
        label: "等效植树",
        value: `${dashboardData.treeEquivalent.toLocaleString()} 棵`,
        icon: "🌱",
      },
      {
        label: "峰谷收益",
        value: `¥ ${dashboardData.arbitrageIncome.toLocaleString()}`,
        icon: "¥",
      },
      { label: "天气", value: dashboardData.weather, icon: "☁" },
    ],
    [dashboardData],
  );

  const leftCharts = useMemo(
    () => [
      {
        title: "辐照度",
        options: createTrendOptions({
          title: "辐照度",
          unit: "W/m²",
          color: isDay ? "#f59e0b" : "#f97316",
          data: irradianceSeries,
          categories,
          mode: "day",
          height: 178,
        }),
      },
      {
        title: "风速",
        options: createTrendOptions({
          title: "风速",
          unit: "m/s",
          color: isDay ? "#0ea5e9" : "#fb923c",
          data: windSeries,
          categories,
          mode: "day",
          height: 178,
        }),
      },
      {
        title: "发电量",
        options: createTrendOptions({
          title: "发电量",
          unit: "MW",
          color: isDay ? "#16a34a" : "#ea580c",
          data: generationSeries,
          categories,
          mode: "day",
          height: 178,
        }),
      },
    ],
    [categories, generationSeries, irradianceSeries, isDay, windSeries],
  );

  const rightCharts = useMemo(
    () => [
      {
        title: "储能 SOC",
        options: {
          chart: {
            type: "pie",
            height: 178,
            backgroundColor: "transparent",
            spacing: [8, 8, 8, 8],
          },
          title: { text: undefined },
          credits: { enabled: false },
          tooltip: { pointFormat: "<b>{point.y:.1f}%</b>" },
          plotOptions: {
            pie: {
              innerSize: "66%",
              dataLabels: { enabled: false },
              borderWidth: 0,
            },
          },
          series: [
            {
              type: "pie",
              data: [
                {
                  name: "SOC",
                  y: socValue,
                  color: isDay ? "#22c55e" : "#f97316",
                },
                {
                  name: "剩余",
                  y: 100 - socValue,
                  color: isDay ? "#dbeafe" : "#ffedd5",
                },
              ],
            },
          ],
        } as Highcharts.Options,
      },
      {
        title: "充放电功率",
        options: {
          chart: {
            type: "column",
            height: 178,
            backgroundColor: "transparent",
            spacing: [8, 8, 8, 8],
          },
          title: { text: undefined },
          credits: { enabled: false },
          legend: { enabled: false },
          xAxis: {
            categories: ["充电", "放电"],
            labels: {
              style: { color: isDay ? "#475569" : "#9a3412", fontSize: "11px" },
            },
          },
          yAxis: {
            title: { text: undefined },
            labels: {
              style: { color: isDay ? "#64748b" : "#9a3412", fontSize: "10px" },
            },
          },
          series: [
            {
              type: "column",
              data: [chargePower || 0.01, dischargePower || 0.01],
              colorByPoint: true,
              colors: [
                isDay ? "#22c55e" : "#fb923c",
                isDay ? "#0ea5e9" : "#f97316",
              ],
            },
          ],
        } as Highcharts.Options,
      },
      {
        title: "负载构成",
        options: {
          chart: {
            type: "pie",
            height: 178,
            backgroundColor: "transparent",
            spacing: [8, 8, 8, 8],
          },
          title: { text: undefined },
          credits: { enabled: false },
          tooltip: { pointFormat: "<b>{point.y:.2f} MW</b>" },
          plotOptions: {
            pie: {
              innerSize: "52%",
              dataLabels: { enabled: true, format: "{point.name}" },
              borderWidth: 0,
            },
          },
          series: [
            {
              type: "pie",
              data: [
                {
                  name: "生产负载",
                  y: loadComposition.production,
                  color: isDay ? "#6366f1" : "#ea580c",
                },
                {
                  name: "工艺负载",
                  y: loadComposition.process,
                  color: isDay ? "#0ea5e9" : "#fb923c",
                },
                {
                  name: "站控负载",
                  y: loadComposition.station,
                  color: isDay ? "#14b8a6" : "#fdba74",
                },
              ],
            },
          ],
        } as Highcharts.Options,
      },
    ],
    [
      chargePower,
      dischargePower,
      isDay,
      loadComposition.process,
      loadComposition.production,
      loadComposition.station,
      socValue,
    ],
  );

  const bottomCharts = useMemo(
    () => [
      {
        title: "逆变器 / 电池簇在线率",
        options: {
          chart: {
            type: "column",
            height: 220,
            backgroundColor: "transparent",
            spacing: [8, 8, 8, 8],
          },
          title: { text: undefined },
          credits: { enabled: false },
          legend: { enabled: false },
          xAxis: {
            categories: ["逆变器", "电池簇"],
            labels: {
              style: { color: isDay ? "#475569" : "#9a3412", fontSize: "11px" },
            },
          },
          yAxis: {
            min: 0,
            max: 100,
            title: { text: undefined },
            labels: {
              format: "{value}%",
              style: { color: isDay ? "#64748b" : "#9a3412", fontSize: "10px" },
            },
          },
          tooltip: { valueSuffix: "%" },
          series: [
            {
              type: "column",
              data: [inverterOnlineRate, batteryClusterOnlineRate],
              colorByPoint: true,
              colors: [
                isDay ? "#22c55e" : "#f97316",
                isDay ? "#0ea5e9" : "#fb923c",
              ],
            },
          ],
        } as Highcharts.Options,
      },
      {
        title: "逆变器发电轨迹",
        options: {
          chart: {
            type: "areaspline",
            height: 260,
            backgroundColor: "transparent",
            spacing: [12, 8, 8, 8],
          },
          title: { text: undefined },
          credits: { enabled: false },
          legend: {
            enabled: true,
            itemStyle: {
              color: isDay ? "#334155" : "#7c2d12",
              fontSize: "10px",
              fontWeight: "500",
            },
          },
          xAxis: {
            categories: Array.from(
              new Map(
                inverterSeries
                  .flatMap((series) =>
                    series.points.map(
                      (point) => [point.timeLabel, point.sortKey] as const,
                    ),
                  )
                  .sort((left, right) => left[1].localeCompare(right[1])),
              ).keys(),
            ),
            tickLength: 0,
            lineColor: isDay
              ? "rgba(148,163,184,0.35)"
              : "rgba(251,146,60,0.32)",
            labels: {
              style: { color: isDay ? "#64748b" : "#9a3412", fontSize: "10px" },
            },
            plotBands: [
              {
                color: isDay
                  ? "rgba(191,219,254,0.22)"
                  : "rgba(254,215,170,0.24)",
                from: 3,
                to: 7,
              },
            ],
          },
          yAxis: [
            {
              title: {
                text: "输出功率",
                style: {
                  color: isDay ? "#2563eb" : "#ea580c",
                  fontSize: "10px",
                },
              },
              min: 0,
              gridLineColor: isDay
                ? "rgba(100,116,139,0.14)"
                : "rgba(217,119,6,0.16)",
              labels: {
                style: {
                  color: isDay ? "#64748b" : "#9a3412",
                  fontSize: "10px",
                },
              },
            },
            {
              title: {
                text: "发电量",
                style: {
                  color: isDay ? "#65a30d" : "#d97706",
                  fontSize: "10px",
                },
              },
              min: 0,
              opposite: true,
              gridLineWidth: 0,
              labels: {
                style: {
                  color: isDay ? "#64748b" : "#9a3412",
                  fontSize: "10px",
                },
              },
            },
          ],
          tooltip: {
            shared: true,
            backgroundColor: isDay
              ? "rgba(255,255,255,0.96)"
              : "rgba(255,247,237,0.96)",
            borderColor: isDay
              ? "rgba(59,130,246,0.28)"
              : "rgba(249,115,22,0.28)",
            shadow: false,
          },
          series: (() => {
            const orderedTimeLabels = Array.from(
              new Map(
                inverterSeries
                  .flatMap((series) =>
                    series.points.map(
                      (point) => [point.timeLabel, point.sortKey] as const,
                    ),
                  )
                  .sort((left, right) => left[1].localeCompare(right[1])),
              ).keys(),
            );
            const pointMapBySeries = inverterSeries.map((series) => {
              const map = new Map(
                series.points.map((point) => [point.timeLabel, point] as const),
              );
              return { source: series.source, map };
            });
            const pacColors = isDay
              ? ["rgba(59,130,246,0.82)", "rgba(96,165,250,0.56)"]
              : ["rgba(249,115,22,0.82)", "rgba(251,146,60,0.56)"];
            const energyColors = isDay
              ? ["rgba(190,242,100,0.78)", "rgba(132,204,22,0.42)"]
              : ["rgba(253,224,71,0.78)", "rgba(250,204,21,0.42)"];

            return pointMapBySeries.flatMap(({ source, map }, seriesIndex) => {
              const pacData = orderedTimeLabels.map(
                (label) => map.get(label)?.pac ?? null,
              );
              const edayData = orderedTimeLabels.map(
                (label) => map.get(label)?.eday ?? null,
              );
              const etotalData = orderedTimeLabels.map(
                (label) => map.get(label)?.etotal ?? null,
              );

              return [
                {
                  type: "areaspline",
                  name: `${source} 输出功率`,
                  data: pacData,
                  yAxis: 0,
                  color: pacColors[seriesIndex] ?? pacColors[0],
                  fillOpacity: seriesIndex === 0 ? 0.28 : 0.18,
                  lineWidth: 2.2,
                  marker: {
                    enabled: true,
                    radius: 2.2,
                    symbol: "circle",
                  },
                  zIndex: seriesIndex === 0 ? 3 : 2,
                },
                {
                  type: "areaspline",
                  name: `${source} 今日发电量`,
                  data: edayData,
                  yAxis: 1,
                  color: energyColors[seriesIndex] ?? energyColors[0],
                  fillOpacity: seriesIndex === 0 ? 0.2 : 0.12,
                  lineWidth: 1.8,
                  marker: {
                    enabled: false,
                  },
                  zIndex: 1,
                },
                {
                  type: "line",
                  name: `${source} 总发电量`,
                  data: etotalData,
                  yAxis: 1,
                  color:
                    seriesIndex === 0
                      ? isDay
                        ? "rgba(101,163,13,0.95)"
                        : "rgba(202,138,4,0.95)"
                      : isDay
                        ? "rgba(132,204,22,0.75)"
                        : "rgba(234,179,8,0.75)",
                  dashStyle: seriesIndex === 0 ? "Solid" : "ShortDash",
                  lineWidth: 1.6,
                  marker: {
                    enabled: false,
                  },
                  zIndex: 4,
                },
              ] satisfies Highcharts.SeriesOptionsType[];
            });
          })(),
          plotOptions: {
            series: {
              animation: false,
              states: {
                hover: {
                  lineWidthPlus: 0,
                },
              },
            },
            areaspline: {
              threshold: null,
            },
          },
          subtitle: inverterSeriesError
            ? {
                text: inverterSeriesError,
                style: {
                  color: isDay ? "#dc2626" : "#f97316",
                  fontSize: "11px",
                },
              }
            : undefined,
        } as Highcharts.Options,
      },
      {
        title: "储能簇实时轨迹",
        options: createBatteryRealtimeOptions({
          points: batteryTelemetryHistory,
          mode: "day",
          connectionState: batteryConnectionState,
        }),
      },
    ],
    [
      batteryConnectionState,
      batteryTelemetryHistory,
      batteryClusterOnlineRate,
      inverterOnlineRate,
      inverterSeries,
      inverterSeriesError,
      isDay,
    ],
  );

  const { nodes, edges } = useMemo(() => {
    const activeLockedNodeId = lockedNodeId;
    const clusterCounts = [26, 26, 26, 26, 26, 25];
    const localCols = 6;
    const ncuWidth = 72;
    const ncuHeight = 38;
    const ncuGapX = 86;
    const ncuGapY = 68;
    const framePaddingX = 24;
    const framePaddingY = 22;
    const frameLabelBand = 34;
    const frameBottomBand = 52;
    const maxRows = 5;
    const frameWidth = framePaddingX * 2 + (localCols - 1) * ncuGapX + ncuWidth;
    const frameHeight =
      framePaddingY * 2 +
      frameLabelBand +
      (maxRows - 1) * ncuGapY +
      ncuHeight +
      frameBottomBand;

    const cabinetNodeWidth = 132;
    const cabinetNodeHeight = 64;
    const cabinetCols = 5;
    const cabinetRows = 2;
    const cabinetRowGap = 142;
    const cabinetColGap = 164;
    const storageContentWidth =
      cabinetNodeWidth + cabinetColGap * (cabinetCols - 1);
    const storageContentHeight =
      cabinetNodeHeight + cabinetRowGap * (cabinetRows - 1);
    const storageFramePaddingX = 62;
    const storageFramePaddingTop = 88;
    const storageFramePaddingBottom = 50;
    const storageFrameWidth = storageContentWidth + storageFramePaddingX * 2;
    const storageFrameHeight =
      storageContentHeight + storageFramePaddingTop + storageFramePaddingBottom;
    const topologyCenterX = 1200;
    const topologyCenterY = 900;
    const storageFrameX = topologyCenterX - storageFrameWidth / 2;
    const storageFrameY = topologyCenterY - storageFrameHeight / 2;
    const storageBusX = topologyCenterX - 34;
    const storageBusY = storageFrameY + 36;
    const cabinetStartX = topologyCenterX - storageContentWidth / 2;
    const cabinetTopY = storageFrameY + storageFramePaddingTop;
    const pvHubIds: string[] = [];
    const clusterOffsets = [
      { x: -790, y: -350 },
      { x: 0, y: -500 },
      { x: 790, y: -350 },
      { x: 790, y: 350 },
      { x: 0, y: 500 },
      { x: -790, y: 350 },
    ] as const;
    const hubLayouts = [
      { x: frameWidth + 8, y: frameHeight * 0.72, sourceHandle: "right" },
      { x: frameWidth / 2, y: frameHeight + 8, sourceHandle: "bottom" },
      { x: -8, y: frameHeight * 0.72, sourceHandle: "left" },
      { x: -8, y: frameHeight * 0.28, sourceHandle: "left" },
      { x: frameWidth / 2, y: -8, sourceHandle: "top" },
      { x: frameWidth + 8, y: frameHeight * 0.28, sourceHandle: "right" },
    ] as const;
    const pvIngressLayouts = [
      {
        x: storageFrameX - 16,
        y: storageFrameY + storageFrameHeight * 0.22,
        targetHandle: "left",
      },
      { x: topologyCenterX, y: storageFrameY - 18, targetHandle: "top" },
      {
        x: storageFrameX + storageFrameWidth + 16,
        y: storageFrameY + storageFrameHeight * 0.22,
        targetHandle: "right",
      },
      {
        x: storageFrameX + storageFrameWidth + 16,
        y: storageFrameY + storageFrameHeight * 0.78,
        targetHandle: "right",
      },
      {
        x: topologyCenterX,
        y: storageFrameY + storageFrameHeight + 18,
        targetHandle: "bottom",
      },
      {
        x: storageFrameX - 16,
        y: storageFrameY + storageFrameHeight * 0.78,
        targetHandle: "left",
      },
    ] as const;

    const flowNodes: Node<TopologyNodeData>[] = [];
    const flowEdges: Edge[] = [];

    let ncuIndex = 1;

    flowNodes.push({
      id: "storage-frame",
      type: "frame",
      position: { x: storageFrameX, y: storageFrameY },
      draggable: false,
      selectable: false,
      data: {
        label: "储能矩阵",
        mode: "day",
        width: storageFrameWidth,
        height: storageFrameHeight,
      },
    });

    flowNodes.push({
      id: "storage-bus",
      type: "hub",
      position: { x: storageBusX, y: storageBusY },
      draggable: false,
      selectable: false,
      data: { label: "", mode: "day" },
    });

    pvIngressLayouts.forEach((ingress, index) => {
      flowNodes.push({
        id: `pv-ingress-${index + 1}`,
        type: "hub",
        position: {
          x: ingress.x,
          y: ingress.y,
        },
        draggable: false,
        selectable: false,
        data: { label: "", mode: "day" },
      });
    });

    for (
      let clusterIndex = 0;
      clusterIndex < clusterCounts.length;
      clusterIndex += 1
    ) {
      const baseX =
        topologyCenterX + clusterOffsets[clusterIndex].x - frameWidth / 2;
      const baseY =
        topologyCenterY + clusterOffsets[clusterIndex].y - frameHeight / 2;
      const hubLayout = hubLayouts[clusterIndex];

      flowNodes.push({
        id: `frame-${clusterIndex + 1}`,
        type: "frame",
        position: { x: baseX, y: baseY },
        draggable: false,
        selectable: false,
        data: {
          label: `光伏矩阵 ${clusterIndex + 1}`,
          mode: "day",
          width: frameWidth,
          height: frameHeight,
        },
      });

      const hubId = `hub-${clusterIndex + 1}`;
      pvHubIds.push(hubId);
      flowNodes.push({
        id: hubId,
        type: "hub",
        position: {
          x: baseX + hubLayout.x,
          y: baseY + hubLayout.y,
        },
        draggable: false,
        selectable: false,
        data: { label: "", mode: "day" },
      });

      for (let i = 0; i < clusterCounts[clusterIndex]; i += 1) {
        const localRow = Math.floor(i / localCols);
        const localCol = i % localCols;
        const runtime = pvRuntimeData[ncuIndex - 1];
        const nodeId = `ncu-${ncuIndex}`;
        const interaction = activeLockedNodeId
          ? {
              disabled: nodeId !== activeLockedNodeId,
              locked: nodeId === activeLockedNodeId,
            }
          : {
              disabled: false,
              locked: false,
            };
        flowNodes.push({
          id: nodeId,
          type: "ncu",
          position: {
            x: baseX + framePaddingX + localCol * ncuGapX,
            y: baseY + framePaddingY + frameLabelBand + localRow * ncuGapY,
          },
          draggable: false,
          selectable: false,
          data: {
            label: `N${ncuIndex}`,
            mode: "day",
            status: runtime.status,
            hasWorkOrder: runtime.hasWorkOrder,
            disabled: interaction.disabled,
            locked: interaction.locked,
            highlighted: nodeId === highlightedNodeId,
          },
        });
        ncuIndex += 1;
      }

      flowEdges.push({
        id: `edge-energy-flow-${clusterIndex + 1}`,
        source: hubId,
        sourceHandle: hubLayout.sourceHandle,
        target: `pv-ingress-${clusterIndex + 1}`,
        targetHandle: pvIngressLayouts[clusterIndex].targetHandle,
        type: "smoothstep",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: topologyTheme.flowEdge,
          width: 18,
          height: 18,
        },
        style: {
          stroke: topologyTheme.flowEdge,
          strokeWidth: 2.5,
          strokeDasharray: "10 6",
          opacity: 0.98,
          filter: "drop-shadow(0 0 6px rgba(56,189,248,0.55))",
        },
      });
    }

    for (let i = 0; i < 10; i += 1) {
      const row = Math.floor(i / 5);
      const indexInRow = i % 5;
      const displayIndex = row === 0 ? indexInRow : 4 - indexInRow;
      const runtime = cabinetRuntimeData[i];
      const nodeId = `cabinet-${i + 1}`;
      const interaction = activeLockedNodeId
        ? {
            disabled: nodeId !== activeLockedNodeId,
            locked: nodeId === activeLockedNodeId,
          }
        : {
            disabled: false,
            locked: false,
          };
      flowNodes.push({
        id: nodeId,
        type: "cabinet",
        position: {
          x: cabinetStartX + displayIndex * cabinetColGap,
          y: cabinetTopY + row * cabinetRowGap,
        },
        draggable: false,
        selectable: false,
        data: {
          label: `储能电柜 E${i + 1}`,
          subtitle: row === 0 ? "A列" : "B列",
          mode: "day",
          status: runtime.status,
          hasWorkOrder: runtime.hasWorkOrder,
          metrics: runtime.metrics,
          disabled: interaction.disabled,
          locked: interaction.locked,
          highlighted: nodeId === highlightedNodeId,
        },
      });

      flowEdges.push({
        id: `edge-storage-${i + 1}`,
        source: "storage-bus",
        sourceHandle: "bottom",
        target: `cabinet-${i + 1}`,
        targetHandle: "top",
        animated: true,
        style: {
          stroke: topologyTheme.flowEdge,
          strokeWidth: 1.6,
          strokeDasharray: "4 3",
        },
      });
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    cabinetRuntimeData,
    highlightedNodeId,
    lockedNodeId,
    pvRuntimeData,
    topologyTheme.flowEdge,
  ]);

  const handleSiteToastClick = () => {
    if (!siteToast?.actionable || !simulatedReviewNodeId) {
      return;
    }

    setTopologyView("2d");
    setHighlightedNodeId(simulatedReviewNodeId);
    setFocusNodeId(simulatedReviewNodeId);
    showTopologyTip(
      `已定位异常设备 ${simulatedReviewNodeId.toUpperCase().replace("-", " ")}`,
    );
  };

  useEffect(() => {
    if (topologyView !== "2d" || !focusNodeId) {
      return;
    }

    const flowInstance = reactFlowInstanceRef.current;
    if (!flowInstance) {
      return;
    }

    const targetNode = nodes.find((node) => node.id === focusNodeId);
    if (!targetNode) {
      return;
    }

    const nodeWidth = targetNode.measured?.width ?? targetNode.width ?? 72;
    const nodeHeight = targetNode.measured?.height ?? targetNode.height ?? 38;
    const centerX = targetNode.position.x + nodeWidth / 2;
    const centerY = targetNode.position.y + nodeHeight / 2;

    window.requestAnimationFrame(() => {
      flowInstance.setCenter(centerX, centerY, {
        zoom: 1.18,
        duration: 420,
      });
      setFocusNodeId(null);
    });
  }, [focusNodeId, nodes, topologyView]);

  const routeToDeviceDetail = (
    device: Pick<PatrolLockedDevice, "nodeId" | "nodeLabel" | "nodeType">,
    inspectionEvent?: RobotInspectionEvent,
  ) => {
    const query = new URLSearchParams({
      hasWorkOrder: "1",
      nodeType: device.nodeType,
      nodeLabel: device.nodeLabel,
      nodeId: device.nodeId,
      returnTo: `/sites/${siteId}/2d`,
    });

    const inspectionAngles =
      device.nodeType === "ncu" && inspectionEvent
        ? parseInspectionAngles(inspectionEvent)
        : null;
    if (inspectionAngles) {
      query.set("actualAngle", inspectionAngles.actualAngle.toFixed(1));
      query.set("targetAngle", inspectionAngles.targetAngle.toFixed(1));
    }

    router.push(
      `/sites/${siteId}/devices/${DEVICE_DETAIL_ID}?${query.toString()}`,
    );
  };

  const beginLockedDeviceInspection = () => {
    if (!lockedDevice) {
      showTopologyTip("当前巡检任务缺少锁定设备，请重新开始巡检。");
      return;
    }

    void beginInspection(
      {
        siteId,
        nodeId: lockedDevice.nodeId,
        nodeLabel: lockedDevice.nodeLabel,
      },
      (event) => {
        routeToDeviceDetail(lockedDevice, event);
      },
    );
  };

  const handleTopologyNodeClick = (
    _: unknown,
    node: Node<TopologyNodeData>,
  ) => {
    if (topologyView !== "2d") {
      return;
    }

    if (node.type !== "ncu" && node.type !== "cabinet") {
      return;
    }

    if (lockedNodeId) {
      if (node.id !== lockedNodeId) {
        showTopologyTip("当前机器人正在处理已锁定设备");
        return;
      }

      showTopologyTip("请使用右上角任务卡进行扫码连接");
      return;
    }

    const hasWorkOrder = node.data?.hasWorkOrder ? "1" : "0";
    const query = new URLSearchParams({
      hasWorkOrder,
      nodeType: String(node.type),
      nodeLabel: String(node.data?.label ?? ""),
      nodeId: node.id,
      returnTo: `/sites/${siteId}/2d`,
    });

    const targetUrl = `/sites/${siteId}/devices/${DEVICE_DETAIL_ID}?${query.toString()}`;
    if (hasWorkOrder === "1") {
      void beginInspection(
        {
          siteId,
          nodeId: node.id,
          nodeLabel: String(node.data?.label ?? ""),
        },
        (event) => {
          routeToDeviceDetail(
            {
              nodeId: node.id,
              nodeLabel: String(node.data?.label ?? ""),
              nodeType: String(node.type),
            },
            event,
          );
        },
      );
      return;
    }

    router.push(targetUrl);
  };

  return (
    <ReactFlowProvider>
      <div
        className={`h-screen w-screen overflow-hidden bg-gradient-to-br ${pageTheme.shell} text-slate-900`}
      >
        <RobotInspectionModal
          dialogState={dialogState}
          onClose={closeDialog}
          onRetryPermission={() => {
            void retryPermission();
          }}
        />
        <RobotPatrolModal
          open={patrolModalOpen}
          loading={patrolModalLoading}
          message={patrolState.message}
          error={patrolState.error}
          onClose={dismissPatrolError}
        />
        {siteToast ? (
          <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2">
            <button
              type="button"
              onClick={handleSiteToastClick}
              disabled={!siteToast.actionable}
              className={`flex items-center gap-3 rounded-full border px-5 py-3 shadow-[0_22px_50px_rgba(103,146,181,0.18)] backdrop-blur-xl ${
                siteToast.tone === "critical"
                  ? "border-red-200/90 bg-white/92 text-red-700"
                  : "border-sky-100 bg-white/92 text-sky-800"
              } ${siteToast.actionable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  siteToast.tone === "critical"
                    ? "bg-red-50 text-red-600 ring-1 ring-red-100"
                    : "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
                }`}
              >
                {siteToast.tone === "critical" ? "!" : "•"}
              </span>
              <p className="max-w-[860px] text-sm font-semibold leading-6">
                {siteToast.message}
              </p>
            </button>
          </div>
        ) : null}
        <div className="flex h-full w-full flex-col gap-2 p-2">
          <header
            className={`rounded-2xl border px-4 py-3 backdrop-blur-sm ${pageTheme.panel} ${pageTheme.panelShadow}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className={`text-xs font-semibold tracking-[0.12em] uppercase ${pageTheme.accent}`}
                >
                  2D 场站详情
                </p>
                <h1 className={`text-lg font-semibold ${pageTheme.textMain}`}>
                  {dashboardData.siteName}
                </h1>
                <p className={`text-xs ${pageTheme.textSub}`}>
                  {dashboardData.location} · 装机容量 {dashboardData.capacity}{" "}
                  MW
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/global-operations")}
                className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-4 py-2 text-sm font-semibold text-sky-700 shadow-[0_10px_24px_rgba(14,116,144,0.12)] transition hover:border-sky-300 hover:text-sky-800"
              >
                <span aria-hidden="true">←</span>
                返回全球运营总览
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              {overviewCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-lg border px-2.5 py-2 ${pageTheme.panel}`}
                >
                  <p className="text-[11px] text-slate-500">
                    {card.icon} {card.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </header>

          <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden xl:grid-cols-12 xl:grid-rows-[minmax(0,1fr)_320px]">
            <section
              className={`min-h-0 overflow-hidden rounded-2xl border p-2.5 xl:col-span-3 xl:row-span-1 ${pageTheme.panel} ${pageTheme.panelShadow}`}
            >
              <p
                className={`px-1 pb-1 text-xs font-semibold tracking-[0.08em] uppercase ${pageTheme.accent}`}
              >
                环境与发电
              </p>
              <div className="grid h-[600px] min-h-0 grid-rows-3 gap-2 xl:h-full">
                {leftCharts.map((item) => (
                  <div
                    key={item.title}
                    className="min-h-0 overflow-hidden rounded-xl border border-white/70 bg-white/65 p-2"
                  >
                    <p className="px-1 text-[11px] font-semibold text-slate-600">
                      {item.title}
                    </p>
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={item.options}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section
              ref={topologyPanelRef}
              className={`min-h-0 overflow-hidden border xl:col-span-6 xl:row-span-1 flex flex-col ${
                isTopologyFullscreen
                  ? `h-full w-full rounded-none p-4 shadow-none ${topologyTheme.panel}`
                  : `rounded-2xl p-2.5 ${topologyTheme.panel} ${topologyTheme.panelShadow}`
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p
                  className={`text-xs font-semibold tracking-[0.08em] uppercase ${topologyTheme.accent}`}
                >
                  场站拓扑
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void startPatrol();
                    }}
                    disabled={
                      !isPatrolSupported ||
                      (patrolState.status !== "idle" &&
                        patrolState.status !== "error")
                    }
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      !isPatrolSupported ||
                      (patrolState.status !== "idle" &&
                        patrolState.status !== "error")
                        ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                        : "border border-cyan-200 bg-cyan-50 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-100"
                    }`}
                  >
                    {patrolState.status === "anomaly" ? "巡检中" : "开始巡检"}
                  </button>
                  {!isPatrolSupported ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                      {unsupportedPatrolMessage}
                    </span>
                  ) : null}
                  <div className="inline-flex rounded-full border border-slate-200/80 bg-white/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setTopologyView("2d")}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                        topologyView === "2d"
                          ? "bg-sky-500/20 text-sky-700"
                          : "text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      2D视角
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopologyView("3d")}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                        topologyView === "3d"
                          ? "bg-sky-500/20 text-sky-700"
                          : "text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      3D视角
                    </button>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${topologyTheme.chip}`}
                  >
                    155 NCU · 10 储能电柜
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleTopologyFullscreen();
                    }}
                    className="rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100/80"
                  >
                    {isTopologyFullscreen ? "退出全屏" : "全屏"}
                  </button>
                </div>
              </div>
              {topologyView === "2d" ? (
                <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                  {STATUS_ORDER.map((status) => {
                    const color = STATUS_COLORS[status];
                    return (
                      <span
                        key={status}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        <i
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{
                            backgroundColor: color.background,
                            border: `1px solid ${color.border}`,
                          }}
                        />
                        {STATUS_LABELS[status]}
                      </span>
                    );
                  })}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600">
                    <i className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold leading-none text-white">
                      工
                    </i>
                    待处理工单
                  </span>
                </div>
              ) : null}
              <div
                className={`relative flex-1 overflow-hidden border border-white/70 ${
                  isTopologyFullscreen
                    ? "min-h-0 rounded-2xl"
                    : "min-h-[540px] rounded-xl xl:min-h-0"
                }`}
                style={{ backgroundColor: topologyTheme.flowBg }}
              >
                <RobotPatrolLockCard
                  open={Boolean(lockedDevice)}
                  device={lockedDevice}
                  message={patrolState.message}
                  error={patrolState.error}
                  scanPending={
                    dialogState.open &&
                    ![
                      "permission_denied",
                      "permission_unresolved",
                      "failed",
                    ].includes(dialogState.phase)
                  }
                  onConnect={beginLockedDeviceInspection}
                />
                {topologyView === "2d" ? (
                  <>
                    <ReactFlow
                      onInit={(instance) => {
                        reactFlowInstanceRef.current = instance;
                      }}
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      onNodeClick={handleTopologyNodeClick}
                      fitView
                      fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={false}
                      panOnDrag
                      zoomOnScroll
                      minZoom={0.24}
                      maxZoom={1.6}
                      translateExtent={[
                        [-260, -180],
                        [2300, 1900],
                      ]}
                    >
                      <Background color={topologyTheme.flowGrid} gap={24} />
                      <Controls
                        showInteractive={false}
                        position="bottom-left"
                        style={{ marginLeft: 16, marginBottom: 24 }}
                      />
                    </ReactFlow>

                    {blockedNodeMessage ? (
                      <div className="pointer-events-none absolute right-4 bottom-4 z-30 max-w-[320px] rounded-2xl border border-slate-200/85 bg-white/92 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                        {blockedNodeMessage}
                      </div>
                    ) : null}

                    {ncuPanelOpen ? (
                      <div className="pointer-events-auto absolute top-4 left-4 z-20 w-[248px] overflow-hidden rounded-xl border border-sky-200/80 bg-white/88 shadow-[0_10px_24px_rgba(14,116,144,0.18)] backdrop-blur-sm">
                        <div className="flex items-center justify-between border-b border-sky-100/80 bg-sky-50/70 px-3 py-2">
                          <div>
                            <p className="text-[11px] font-semibold tracking-[0.08em] text-sky-700 uppercase">
                              NCU纵览
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              状态统计与工单概况
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNcuPanelOpen(false)}
                            className="rounded-md border border-sky-200/80 bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
                            title="收起NCU纵览面板"
                          >
                            －
                          </button>
                        </div>
                        <div className="space-y-2 p-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            {STATUS_ORDER.map((status) => {
                              const color = STATUS_COLORS[status];
                              return (
                                <div
                                  key={`ncu-overview-${status}`}
                                  className="rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                                      <i
                                        className="h-2.5 w-2.5 rounded-sm"
                                        style={{
                                          backgroundColor: color.background,
                                          border: `1px solid ${color.border}`,
                                        }}
                                      />
                                      {STATUS_LABELS[status]}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700">
                                      {ncuOverview.counts[status]}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="rounded-lg border border-rose-200/70 bg-rose-50/70 px-2 py-1.5">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                                <i className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold leading-none text-white">
                                  工
                                </i>
                                工单总数
                              </span>
                              <span className="text-sm font-bold text-rose-700">
                                {ncuOverview.workOrderTotal}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNcuPanelOpen(true)}
                        className="pointer-events-auto absolute top-4 left-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/90 bg-white/90 text-lg text-sky-700 shadow-[0_8px_20px_rgba(14,116,144,0.2)] hover:bg-sky-50"
                        title="展开NCU纵览面板"
                      >
                        N
                      </button>
                    )}

                    {cabinetPanelOpen ? (
                      <div
                        className="pointer-events-auto absolute right-4 bottom-4 z-20 overflow-hidden rounded-xl border border-sky-200/80 bg-white/86 shadow-[0_10px_24px_rgba(14,116,144,0.18)] backdrop-blur-sm"
                        style={{ width: "min(560px, calc(100% - 24px))" }}
                      >
                        <div className="flex items-center justify-between border-b border-sky-100/80 bg-sky-50/70 px-3 py-2">
                          <div>
                            <p className="text-[11px] font-semibold tracking-[0.08em] text-sky-700 uppercase">
                              储能电柜实时数据
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              温度 · 电量 · 电压 · 电流
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCabinetPanelOpen(false)}
                            className="rounded-md border border-sky-200/80 bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
                            title="收起储能数据面板"
                          >
                            －
                          </button>
                        </div>
                        <div className="grid grid-cols-5 gap-2 p-2">
                          {cabinetRuntimeData.map((item, index) => {
                            const soc = Math.max(
                              0,
                              Math.min(100, item.metrics.soc),
                            );
                            const tempPercent = Math.max(
                              0,
                              Math.min(100, item.metrics.temperature),
                            );
                            const temperaturePalette = getTemperaturePalette(
                              item.metrics.temperature,
                            );
                            const tempColor = getTemperatureColor(
                              item.metrics.temperature,
                            );
                            const socFillHeight = Math.max(2, (soc / 100) * 58);
                            const tempFillHeight = Math.max(
                              2,
                              (tempPercent / 100) * 58,
                            );
                            return (
                              <div
                                key={`cabinet-metrics-${index + 1}`}
                                className="min-w-0 rounded-lg border border-sky-100/80 bg-white/75 px-2 py-1.5"
                              >
                                <div className="flex items-center justify-between text-[9px] text-slate-600">
                                  <span className="font-semibold text-slate-700">
                                    {item.metrics.voltage}V
                                  </span>
                                  <span>{item.metrics.current}A</span>
                                </div>
                                <div className="mt-1 flex justify-center">
                                  <svg
                                    width="52"
                                    height="82"
                                    viewBox="0 0 52 82"
                                    role="img"
                                    aria-label={`储能电柜E${index + 1} 电量${soc}% 温度${item.metrics.temperature}度`}
                                  >
                                    <rect
                                      x="20"
                                      y="2"
                                      width="12"
                                      height="6"
                                      rx="2"
                                      fill="#cbd5e1"
                                    />
                                    <rect
                                      x="8"
                                      y="8"
                                      width="36"
                                      height="70"
                                      rx="8"
                                      fill="rgba(226,232,240,0.45)"
                                      stroke="rgba(148,163,184,0.9)"
                                      strokeWidth="1.4"
                                    />
                                    <rect
                                      x="12"
                                      y="12"
                                      width="24"
                                      height="58"
                                      rx="4"
                                      fill="rgba(241,245,249,0.9)"
                                    />
                                    <rect
                                      x="12"
                                      y={70 - socFillHeight}
                                      width="24"
                                      height={socFillHeight}
                                      rx="3"
                                      fill={tempColor}
                                      opacity="0.9"
                                    />
                                    <rect
                                      x="38"
                                      y="12"
                                      width="4"
                                      height="58"
                                      rx="2"
                                      fill="rgba(226,232,240,0.9)"
                                    />
                                    <rect
                                      x="38"
                                      y={70 - tempFillHeight}
                                      width="4"
                                      height={tempFillHeight}
                                      rx="2"
                                      fill={tempColor}
                                    />
                                    <text
                                      x="26"
                                      y="45"
                                      textAnchor="middle"
                                      fontSize="8"
                                      fill="#0f172a"
                                      fontWeight="700"
                                    >
                                      {soc}%
                                    </text>
                                  </svg>
                                </div>
                                <div className="mt-0.5 text-center text-[9px] text-slate-600">
                                  <span className="font-semibold text-slate-700">
                                    E{index + 1}
                                  </span>
                                  <span className="ml-1">SOC {soc}%</span>
                                </div>
                                <div className="mt-0.5 text-center text-[9px]">
                                  <span
                                    className="rounded-full border px-1.5 py-0.5 font-semibold"
                                    style={{
                                      background: temperaturePalette.background,
                                      borderColor: temperaturePalette.border,
                                      color: temperaturePalette.text,
                                    }}
                                  >
                                    {item.metrics.temperature}°C
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCabinetPanelOpen(true)}
                        className="pointer-events-auto absolute right-4 bottom-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/90 bg-white/90 text-lg text-sky-700 shadow-[0_8px_20px_rgba(14,116,144,0.2)] hover:bg-sky-50"
                        title="展开储能数据面板"
                      >
                        🔋
                      </button>
                    )}
                  </>
                ) : (
                  <SiteTopologyFlow dashboardData={dashboardData} embedded />
                )}
              </div>
            </section>

            <section
              className={`min-h-0 overflow-hidden rounded-2xl border p-2.5 xl:col-span-3 xl:row-span-1 ${pageTheme.panel} ${pageTheme.panelShadow}`}
            >
              <p
                className={`px-1 pb-1 text-xs font-semibold tracking-[0.08em] uppercase ${pageTheme.accent}`}
              >
                储能与负载
              </p>
              <div className="grid h-[600px] min-h-0 grid-rows-3 gap-2 xl:h-full">
                {rightCharts.map((item) => (
                  <div
                    key={item.title}
                    className="min-h-0 overflow-hidden rounded-xl border border-white/70 bg-white/65 p-2"
                  >
                    <p className="px-1 text-[11px] font-semibold text-slate-600">
                      {item.title}
                    </p>
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={item.options}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`min-h-0 overflow-hidden rounded-2xl border p-2.5 xl:col-span-12 xl:row-span-1 ${pageTheme.panel} ${pageTheme.panelShadow}`}
            >
              <p
                className={`px-1 pb-1 text-xs font-semibold tracking-[0.08em] uppercase ${pageTheme.accent}`}
              >
                设备运行与运维
              </p>
              <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-3">
                {bottomCharts.map((item) => (
                  <div
                    key={item.title}
                    className="min-h-0 overflow-hidden rounded-xl border border-white/70 bg-white/65 p-2"
                  >
                    <p className="px-1 text-[11px] font-semibold text-slate-600">
                      {item.title}
                    </p>
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={item.options}
                    />
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
