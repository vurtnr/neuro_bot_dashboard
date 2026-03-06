"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import "@xyflow/react/dist/style.css";
import { generateMinuteLevelData } from "@/utils";

const NCU_COUNT = 155;
const STORAGE_COUNT = 10;
const NCU_CLUSTER_COUNT = 6;
const NCU_CLUSTER_LAYOUT_COLUMNS = 3;
const NCU_CLUSTER_LAYOUT_ROWS = 2;
const MAX_NCU_LABEL_CHARS = `N${NCU_COUNT}`.length;
const NCU_NODE_MIN_WIDTH = 88;
const NCU_NODE_WIDTH = Math.max(NCU_NODE_MIN_WIDTH, 44 + MAX_NCU_LABEL_CHARS * 12);
const NCU_NODE_HEIGHT = 52;
const NCU_GAP_X = 14;
const NCU_GAP_Y = 12;
const NCU_PITCH_X = NCU_NODE_WIDTH + NCU_GAP_X;
const NCU_PITCH_Y = NCU_NODE_HEIGHT + NCU_GAP_Y;
const NCU_CLUSTER_GAP_X = 56;
const NCU_CLUSTER_GAP_Y = 56;

const STORAGE_NODE_WIDTH = NCU_NODE_WIDTH * 2;
const STORAGE_NODE_HEIGHT = NCU_NODE_HEIGHT * 2;
const STORAGE_GAP_X = 20;
const STORAGE_PITCH_X = STORAGE_NODE_WIDTH + STORAGE_GAP_X;
const STORAGE_OFFSET_Y = 132;
const STORAGE_LAYOUT_COLUMNS = 5;
const STORAGE_FACE_TO_FACE_GAP_Y = 36;

type DeviceStatus = "normal" | "warning" | "error";
type StatusMode = "normal" | "demo";
type VisualTheme = "night" | "day";

interface TopologyNodeData extends Record<string, unknown> {
  kind: "ncu" | "storage";
  label: string;
  status?: DeviceStatus;
  temperature?: number;
  hasWorkOrder?: boolean;
}

interface DeviceNodeComponentProps extends NodeProps {
  theme: VisualTheme;
}

interface SiteTopologyFlowProps {
  fullScreen?: boolean;
}

const WARNING_RATE = 0.01;
const ERROR_RATE = 0.005;

function getStatusStyle(status: DeviceStatus, theme: VisualTheme = "night") {
  if (theme === "day") {
    if (status === "error") {
      return {
        border: "#ef4444",
        bg: "linear-gradient(180deg, #fee2e2, #fecaca)",
        text: "#b91c1c",
        glow: "rgba(239,68,68,0.2)",
        miniMap: "#ef4444",
        miniMapStroke: "#b91c1c",
      };
    }

    if (status === "warning") {
      return {
        border: "#f59e0b",
        bg: "linear-gradient(180deg, #fef3c7, #fde68a)",
        text: "#a16207",
        glow: "rgba(245,158,11,0.2)",
        miniMap: "#f59e0b",
        miniMapStroke: "#a16207",
      };
    }

    return {
      border: "#22c55e",
      bg: "linear-gradient(180deg, #dcfce7, #bbf7d0)",
      text: "#166534",
      glow: "rgba(34,197,94,0.18)",
      miniMap: "#22c55e",
      miniMapStroke: "#166534",
    };
  }

  if (status === "error") {
    return {
      border: "#ef4444",
      bg: "linear-gradient(180deg, rgba(127,29,29,0.45), rgba(69,10,10,0.72))",
      text: "#fecaca",
      glow: "rgba(239,68,68,0.42)",
      miniMap: "#ef4444",
      miniMapStroke: "#fca5a5",
    };
  }

  if (status === "warning") {
    return {
      border: "#f59e0b",
      bg: "linear-gradient(180deg, rgba(120,53,15,0.42), rgba(69,26,3,0.72))",
      text: "#fde68a",
      glow: "rgba(245,158,11,0.4)",
      miniMap: "#f59e0b",
      miniMapStroke: "#fcd34d",
    };
  }

  return {
    border: "#22c55e",
    bg: "linear-gradient(180deg, rgba(20,83,45,0.36), rgba(5,46,22,0.74))",
    text: "#bbf7d0",
    glow: "rgba(34,197,94,0.36)",
    miniMap: "#22c55e",
    miniMapStroke: "#86efac",
  };
}

function getStorageTemperatureStyle(temperature: number, theme: VisualTheme = "night") {
  if (theme === "day") {
    if (temperature > 80) {
      return {
        border: "#ef4444",
        bg: "linear-gradient(180deg, #fee2e2, #fecaca)",
        text: "#b91c1c",
        glow: "rgba(239,68,68,0.22)",
        miniMap: "#ef4444",
        miniMapStroke: "#b91c1c",
      };
    }

    if (temperature >= 60) {
      return {
        border: "#f59e0b",
        bg: "linear-gradient(180deg, #fef3c7, #fde68a)",
        text: "#a16207",
        glow: "rgba(245,158,11,0.2)",
        miniMap: "#f59e0b",
        miniMapStroke: "#a16207",
      };
    }

    if (temperature >= 30) {
      return {
        border: "#eab308",
        bg: "linear-gradient(180deg, #fef9c3, #fef08a)",
        text: "#854d0e",
        glow: "rgba(234,179,8,0.2)",
        miniMap: "#eab308",
        miniMapStroke: "#854d0e",
      };
    }

    return {
      border: "#3b82f6",
      bg: "linear-gradient(180deg, #dbeafe, #bfdbfe)",
      text: "#1d4ed8",
      glow: "rgba(59,130,246,0.2)",
      miniMap: "#3b82f6",
      miniMapStroke: "#1d4ed8",
    };
  }

  if (temperature > 80) {
    return {
      border: "#ef4444",
      bg: "linear-gradient(180deg, rgba(127,29,29,0.5), rgba(69,10,10,0.76))",
      text: "#fecaca",
      glow: "rgba(239,68,68,0.48)",
      miniMap: "#ef4444",
      miniMapStroke: "#fca5a5",
    };
  }

  if (temperature >= 60) {
    return {
      border: "#f59e0b",
      bg: "linear-gradient(180deg, rgba(120,53,15,0.46), rgba(69,26,3,0.78))",
      text: "#fde68a",
      glow: "rgba(245,158,11,0.42)",
      miniMap: "#f59e0b",
      miniMapStroke: "#fcd34d",
    };
  }

  if (temperature >= 30) {
    return {
      border: "#eab308",
      bg: "linear-gradient(180deg, rgba(113,63,18,0.42), rgba(66,32,6,0.74))",
      text: "#fef08a",
      glow: "rgba(234,179,8,0.42)",
      miniMap: "#eab308",
      miniMapStroke: "#fde047",
    };
  }

  return {
    border: "#3b82f6",
    bg: "linear-gradient(180deg, rgba(30,58,138,0.44), rgba(23,37,84,0.78))",
    text: "#bfdbfe",
    glow: "rgba(59,130,246,0.44)",
    miniMap: "#3b82f6",
    miniMapStroke: "#93c5fd",
  };
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function createStatusArray(count: number, mode: StatusMode, seedBase: number) {
  if (mode === "normal") {
    return Array.from({ length: count }, () => "normal" as const);
  }

  return Array.from({ length: count }, (_, index) => {
    const value = pseudoRandom(seedBase + index * 97 + 13);

    if (value < ERROR_RATE) {
      return "error" as const;
    }

    if (value < ERROR_RATE + WARNING_RATE) {
      return "warning" as const;
    }

    return "normal" as const;
  });
}

function createStorageTemperatures(mode: StatusMode, seedBase: number) {
  if (mode === "normal") {
    return Array.from({ length: STORAGE_COUNT }, () => 45);
  }

  return Array.from({ length: STORAGE_COUNT }, (_, index) => {
    const value = pseudoRandom(seedBase + index * 53 + 7);
    return Math.round(10 + value * 85);
  });
}

function createTopologyNodes(ncuStatuses: DeviceStatus[], storageTemperatures: number[]) {
  const nodes: Node<TopologyNodeData>[] = [];
  const baseClusterSize = Math.floor(NCU_COUNT / NCU_CLUSTER_COUNT);
  const extraNodeCount = NCU_COUNT % NCU_CLUSTER_COUNT;
  const clusterSizes = Array.from({ length: NCU_CLUSTER_COUNT }, (_, clusterIndex) =>
    baseClusterSize + (clusterIndex < extraNodeCount ? 1 : 0),
  );
  const clusterShapes = clusterSizes.map((size) => {
    const cols = Math.ceil(Math.sqrt(size));
    const rows = Math.ceil(size / cols);
    const width = (cols - 1) * NCU_PITCH_X + NCU_NODE_WIDTH;
    const height = (rows - 1) * NCU_PITCH_Y + NCU_NODE_HEIGHT;

    return { size, cols, rows, width, height };
  });

  const columnWidths = Array.from({ length: NCU_CLUSTER_LAYOUT_COLUMNS }, (_, col) =>
    Math.max(
      ...clusterShapes
        .filter((_, clusterIndex) => clusterIndex % NCU_CLUSTER_LAYOUT_COLUMNS === col)
        .map((shape) => shape.width),
    ),
  );
  const rowHeights = Array.from({ length: NCU_CLUSTER_LAYOUT_ROWS }, (_, row) =>
    Math.max(
      ...clusterShapes
        .filter((_, clusterIndex) => Math.floor(clusterIndex / NCU_CLUSTER_LAYOUT_COLUMNS) === row)
        .map((shape) => shape.height),
    ),
  );

  let ncuStartIndex = 0;
  for (let clusterIndex = 0; clusterIndex < NCU_CLUSTER_COUNT; clusterIndex += 1) {
    const clusterShape = clusterShapes[clusterIndex];
    const layoutCol = clusterIndex % NCU_CLUSTER_LAYOUT_COLUMNS;
    const layoutRow = Math.floor(clusterIndex / NCU_CLUSTER_LAYOUT_COLUMNS);
    const clusterOffsetX =
      columnWidths.slice(0, layoutCol).reduce((acc, width) => acc + width, 0) + layoutCol * NCU_CLUSTER_GAP_X;
    const clusterOffsetY =
      rowHeights.slice(0, layoutRow).reduce((acc, height) => acc + height, 0) + layoutRow * NCU_CLUSTER_GAP_Y;

    for (let localIndex = 0; localIndex < clusterShape.size; localIndex += 1) {
      const globalIndex = ncuStartIndex + localIndex;
      const row = Math.floor(localIndex / clusterShape.cols);
      const col = localIndex % clusterShape.cols;
      const status = ncuStatuses[globalIndex];

      nodes.push({
        id: `ncu-${globalIndex + 1}`,
        type: "device",
        position: {
          x: clusterOffsetX + col * NCU_PITCH_X,
          y: clusterOffsetY + row * NCU_PITCH_Y,
        },
        data: { kind: "ncu", label: `N${globalIndex + 1}`, status, hasWorkOrder: status === "error" },
        style: {
          width: NCU_NODE_WIDTH,
          height: NCU_NODE_HEIGHT,
        },
        selectable: false,
        draggable: false,
      });
    }

    ncuStartIndex += clusterShape.size;
  }

  const ncuNodes = nodes.filter((node) => node.id.startsWith("ncu-"));
  const ncuMinX = Math.min(...ncuNodes.map((node) => node.position.x));
  const ncuMaxX = Math.max(...ncuNodes.map((node) => node.position.x + NCU_NODE_WIDTH));
  const ncuMaxY = Math.max(...ncuNodes.map((node) => node.position.y + NCU_NODE_HEIGHT));
  const matrixCenterX = (ncuMinX + ncuMaxX) / 2;
  const storageTopRowY = ncuMaxY + STORAGE_OFFSET_Y;
  const storageStartCenterX = matrixCenterX - ((STORAGE_LAYOUT_COLUMNS - 1) * STORAGE_PITCH_X) / 2;

  for (let index = 0; index < STORAGE_COUNT; index += 1) {
    const row = Math.floor(index / STORAGE_LAYOUT_COLUMNS);
    const columnIndexInRow = index % STORAGE_LAYOUT_COLUMNS;
    const mirroredColumn = row === 1 ? STORAGE_LAYOUT_COLUMNS - 1 - columnIndexInRow : columnIndexInRow;
    const centerX = storageStartCenterX + mirroredColumn * STORAGE_PITCH_X;
    const rowOffsetY = row * (STORAGE_NODE_HEIGHT + STORAGE_FACE_TO_FACE_GAP_Y);
    const rowY = storageTopRowY + rowOffsetY;
    const temperature = storageTemperatures[index];

    nodes.push({
      id: `storage-${index + 1}`,
      type: "device",
      position: { x: centerX - STORAGE_NODE_WIDTH / 2, y: rowY },
      data: {
        kind: "storage",
        label: `储能电柜-${String(index + 1).padStart(2, "0")}`,
        temperature,
      },
      style: {
        width: STORAGE_NODE_WIDTH,
        height: STORAGE_NODE_HEIGHT,
      },
      selectable: false,
      draggable: false,
    });
  }

  return nodes;
}

function createTopologyEdges() {
  const edges: Edge[] = [];
  return edges;
}

function createMetricChartOptions({
  title,
  unit,
  data,
  categories,
  color,
  isDay,
  chartHeight = 184,
}: {
  title: string;
  unit: string;
  data: number[];
  categories: string[];
  color: string;
  isDay: boolean;
  chartHeight?: number;
}): Highcharts.Options {
  const midIndex = Math.floor(categories.length / 2);

  return {
    chart: {
      type: "areaspline",
      backgroundColor: "transparent",
      spacing: [8, 8, 10, 8],
      height: chartHeight,
      animation: false,
      style: {
        fontFamily: "Inter, Segoe UI, sans-serif",
      },
    },
    title: {
      text: undefined,
    },
    credits: {
      enabled: false,
    },
    legend: {
      enabled: false,
    },
    xAxis: {
      categories,
      tickPositions: [0, midIndex, categories.length - 1],
      lineColor: isDay ? "rgba(100,116,139,0.35)" : "rgba(148,163,184,0.28)",
      tickLength: 0,
      labels: {
        style: {
          color: isDay ? "#475569" : "#94a3b8",
          fontSize: "10px",
        },
      },
      gridLineColor: "transparent",
    },
    yAxis: {
      title: {
        text: undefined,
      },
      gridLineWidth: 1,
      gridLineDashStyle: "ShortDash",
      gridLineColor: isDay ? "rgba(100,116,139,0.25)" : "rgba(148,163,184,0.22)",
      labels: {
        style: {
          color: isDay ? "#64748b" : "#94a3b8",
          fontSize: "10px",
        },
      },
      endOnTick: false,
      startOnTick: true,
    },
    tooltip: {
      shared: true,
      backgroundColor: isDay ? "rgba(255,255,255,0.96)" : "rgba(15,23,42,0.92)",
      borderColor: isDay ? "rgba(148,163,184,0.65)" : "rgba(71,85,105,0.65)",
      style: {
        color: isDay ? "#0f172a" : "#e2e8f0",
      },
      valueSuffix: ` ${unit}`,
      headerFormat: '<span style="font-size:11px">{point.key}</span><br/>',
      pointFormat: `<span style="color:${color}">●</span> ${title}: <b>{point.y:.1f} ${unit}</b><br/>`,
    },
    plotOptions: {
      areaspline: {
        lineWidth: 2,
        color,
        marker: {
          enabled: false,
        },
        fillOpacity: 0.2,
      },
      series: {
        animation: false,
      },
    },
    series: [
      {
        type: "areaspline",
        name: title,
        data,
        color,
      },
    ],
  };
}

function createStorageRuntimeOptions({
  categories,
  onlineData,
  standbyData,
  faultData,
  isDay,
  chartHeight = 184,
}: {
  categories: string[];
  onlineData: number[];
  standbyData: number[];
  faultData: number[];
  isDay: boolean;
  chartHeight?: number;
}): Highcharts.Options {
  const midIndex = Math.floor(categories.length / 2);

  return {
    chart: {
      type: "column",
      backgroundColor: "transparent",
      spacing: [8, 8, 10, 8],
      height: chartHeight,
      animation: false,
      style: {
        fontFamily: "Inter, Segoe UI, sans-serif",
      },
    },
    title: {
      text: undefined,
    },
    credits: {
      enabled: false,
    },
    xAxis: {
      categories,
      tickPositions: [0, midIndex, categories.length - 1],
      lineColor: isDay ? "rgba(100,116,139,0.35)" : "rgba(148,163,184,0.28)",
      tickLength: 0,
      labels: {
        style: {
          color: isDay ? "#475569" : "#94a3b8",
          fontSize: "10px",
        },
      },
      gridLineColor: "transparent",
    },
    yAxis: {
      title: {
        text: undefined,
      },
      gridLineWidth: 1,
      gridLineDashStyle: "ShortDash",
      gridLineColor: isDay ? "rgba(100,116,139,0.25)" : "rgba(148,163,184,0.22)",
      labels: {
        style: {
          color: isDay ? "#64748b" : "#94a3b8",
          fontSize: "10px",
        },
      },
      max: STORAGE_COUNT,
      min: 0,
      tickInterval: 2,
      stackLabels: {
        enabled: false,
      },
    },
    tooltip: {
      shared: true,
      backgroundColor: isDay ? "rgba(255,255,255,0.96)" : "rgba(15,23,42,0.92)",
      borderColor: isDay ? "rgba(148,163,184,0.65)" : "rgba(71,85,105,0.65)",
      style: {
        color: isDay ? "#0f172a" : "#e2e8f0",
      },
      headerFormat: '<span style="font-size:11px">{point.key}</span><br/>',
    },
    legend: {
      enabled: true,
      itemStyle: {
        color: isDay ? "#334155" : "#cbd5e1",
        fontSize: "10px",
        fontWeight: "500",
      },
      symbolRadius: 2,
      symbolHeight: 8,
      symbolWidth: 10,
    },
    plotOptions: {
      column: {
        stacking: "normal",
        borderWidth: 0,
        pointPadding: 0.05,
        groupPadding: 0.08,
      },
      series: {
        animation: false,
      },
    },
    series: [
      {
        type: "column",
        name: "在线",
        data: onlineData,
        color: isDay ? "#22c55e" : "#4ade80",
      },
      {
        type: "column",
        name: "待机",
        data: standbyData,
        color: isDay ? "#0ea5e9" : "#38bdf8",
      },
      {
        type: "column",
        name: "异常",
        data: faultData,
        color: isDay ? "#ef4444" : "#f87171",
      },
    ],
  };
}

const DeviceNode = memo(function DeviceNode({ data, theme }: DeviceNodeComponentProps) {
  const nodeData = data as TopologyNodeData;
  const isStorage = nodeData.kind === "storage";
  const hasWorkOrderBadge = !isStorage && nodeData.hasWorkOrder;
  const style = isStorage
    ? getStorageTemperatureStyle(nodeData.temperature ?? 45, theme)
    : getStatusStyle(nodeData.status ?? "normal", theme);

  const mainLabelStyle = isStorage
    ? {
        fontSize: "clamp(10px, 0.85vw, 12px)",
        lineHeight: 1.15,
      }
    : {
        fontSize: "clamp(12px, 1vw, 16px)",
        lineHeight: 1.05,
        letterSpacing: "0.02em",
      };

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] border ${
        hasWorkOrderBadge ? "cursor-pointer" : ""
      }`}
      style={{
        borderColor: style.border,
        background: style.bg,
        color: style.text,
        boxShadow: `0 0 0 1px ${style.border} inset, 0 0 18px ${style.glow}`,
      }}
    >
      <div
        className={`absolute top-1 left-2 text-[9px] font-semibold tracking-[0.08em] ${
          theme === "day" ? "text-slate-700/70" : "text-slate-200/75"
        }`}
      >
        {isStorage ? "BESS" : "NCU"}
      </div>
      {hasWorkOrderBadge ? (
        <div
          className={`absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
            theme === "day" ? "bg-red-500 text-white" : "bg-red-400 text-slate-950"
          }`}
          title="维护工单 1 条"
        >
          1
        </div>
      ) : null}
      <div
        className={`max-w-[95%] truncate text-center font-semibold tracking-wide ${
          isStorage ? "pt-2 text-[11px]" : "pt-3 text-[13px]"
        }`}
        style={mainLabelStyle}
      >
        {nodeData.label}
      </div>
      <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.border }} />
    </div>
  );
});

export default function SiteTopologyFlow({ fullScreen = false }: SiteTopologyFlowProps) {
  const [statusMode, setStatusMode] = useState<StatusMode>("normal");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [visualTheme, setVisualTheme] = useState<VisualTheme>("day");
  const router = useRouter();
  const params = useParams<{ siteId?: string | string[] }>();
  const chartsContainerRef = useRef<HTMLElement | null>(null);
  const [chartHeight, setChartHeight] = useState(170);
  const siteId = useMemo(() => {
    if (!params?.siteId) {
      return "alpha";
    }

    return Array.isArray(params.siteId) ? params.siteId[0] : params.siteId;
  }, [params]);

  const topology = useMemo(() => {
    const ncuStatuses = createStatusArray(NCU_COUNT, statusMode, refreshNonce * 1000 + 101);
    const storageTemperatures = createStorageTemperatures(statusMode, refreshNonce * 1000 + 707);

    return {
      nodes: createTopologyNodes(ncuStatuses, storageTemperatures),
      edges: createTopologyEdges(),
    };
  }, [statusMode, refreshNonce]);

  const [nodes, setNodes, onNodesChange] = useNodesState(topology.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(topology.edges);

  useEffect(() => {
    setNodes(topology.nodes);
    setEdges(topology.edges);
  }, [setEdges, setNodes, topology.edges, topology.nodes]);

  const nodeTypes = useMemo(
    () => ({
      device: (props: NodeProps) => <DeviceNode {...props} theme={visualTheme} />,
    }),
    [visualTheme],
  );

  const ncuStatusSummary = useMemo(() => {
    return nodes
      .filter((node) => node.id.startsWith("ncu-"))
      .reduce(
        (acc, node) => {
          const status = (node.data?.status as DeviceStatus) ?? "normal";
          acc[status] += 1;
          return acc;
        },
        { normal: 0, warning: 0, error: 0 },
      );
  }, [nodes]);

  const storageTempSummary = useMemo(() => {
    return nodes.filter((node) => node.id.startsWith("storage-")).reduce(
      (acc, node) => {
        const temperature = (node.data?.temperature as number) ?? 45;

        if (temperature > 80) {
          acc.red += 1;
        } else if (temperature >= 60) {
          acc.orange += 1;
        } else if (temperature >= 30) {
          acc.yellow += 1;
        } else {
          acc.blue += 1;
        }

        return acc;
      },
      { red: 0, orange: 0, yellow: 0, blue: 0 },
    );
  }, [nodes]);

  const minuteData = useMemo(() => generateMinuteLevelData(), []);
  const sampledData = useMemo(() => {
    return minuteData.filter((_, index) => index % 5 === 0 || index === minuteData.length - 1);
  }, [minuteData]);
  const chartCategories = useMemo(() => sampledData.map((point) => point.time), [sampledData]);
  const irradianceSeries = useMemo(() => sampledData.map((point) => point.irradiance), [sampledData]);
  const windSeries = useMemo(() => sampledData.map((point) => point.windSpeed), [sampledData]);
  const generationSeries = useMemo(() => {
    return sampledData.map((point, index) => {
      const irradianceRatio = point.irradiance / 1000;
      const loadFactor = 0.94 + 0.06 * Math.sin(index / 9);
      return Number(Math.max(0, irradianceRatio * 62 * loadFactor).toFixed(2));
    });
  }, [sampledData]);
  const storageRuntimeSeries = useMemo(() => {
    const total = sampledData.length - 1 || 1;

    const onlineData: number[] = [];
    const standbyData: number[] = [];
    const faultData: number[] = [];

    sampledData.forEach((_, index) => {
      const progress = index / total;
      const fault = progress > 0.6 && progress < 0.68 ? 1 : 0;
      const ripple = Math.sin(progress * Math.PI * 6);
      const standbyBase = progress < 0.2 || progress > 0.82 ? 2 : 1;
      const standby = Math.min(STORAGE_COUNT - fault, standbyBase + (ripple > 0.85 ? 1 : 0));
      const online = Math.max(0, STORAGE_COUNT - standby - fault);

      onlineData.push(online);
      standbyData.push(standby);
      faultData.push(fault);
    });

    return {
      onlineData,
      standbyData,
      faultData,
    };
  }, [sampledData]);

  const isDay = visualTheme === "day";

  useEffect(() => {
    const container = chartsContainerRef.current;

    if (!container) {
      return;
    }

    const computeChartHeight = () => {
      const containerHeight = container.clientHeight;
      const gaps = 12 * 3;
      const singleCardHeight = Math.max(140, (containerHeight - gaps) / 4);
      const estimatedHeaderAndPadding = 36;
      const nextChartHeight = Math.max(104, Math.floor(singleCardHeight - estimatedHeaderAndPadding));
      setChartHeight(nextChartHeight);
    };

    computeChartHeight();

    const observer = new ResizeObserver(computeChartHeight);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const irradianceOptions = useMemo(
    () =>
      createMetricChartOptions({
        title: "辐照曲线",
        unit: "W/m²",
        data: irradianceSeries,
        categories: chartCategories,
        color: isDay ? "#f59e0b" : "#fbbf24",
        isDay,
        chartHeight,
      }),
    [chartCategories, chartHeight, irradianceSeries, isDay],
  );

  const windOptions = useMemo(
    () =>
      createMetricChartOptions({
        title: "风速曲线",
        unit: "m/s",
        data: windSeries,
        categories: chartCategories,
        color: isDay ? "#0ea5e9" : "#38bdf8",
        isDay,
        chartHeight,
      }),
    [chartCategories, chartHeight, isDay, windSeries],
  );
  const generationOptions = useMemo(
    () =>
      createMetricChartOptions({
        title: "发电功率",
        unit: "MW",
        data: generationSeries,
        categories: chartCategories,
        color: isDay ? "#16a34a" : "#4ade80",
        isDay,
        chartHeight,
      }),
    [chartCategories, chartHeight, generationSeries, isDay],
  );
  const storageRuntimeOptions = useMemo(
    () =>
      createStorageRuntimeOptions({
        categories: chartCategories,
        onlineData: storageRuntimeSeries.onlineData,
        standbyData: storageRuntimeSeries.standbyData,
        faultData: storageRuntimeSeries.faultData,
        isDay,
        chartHeight,
      }),
    [chartCategories, chartHeight, isDay, storageRuntimeSeries.faultData, storageRuntimeSeries.onlineData, storageRuntimeSeries.standbyData],
  );

  const containerClass = fullScreen
    ? `site-topology-flow relative h-full min-h-screen w-full overflow-hidden ${
        isDay ? "border-0 bg-[#e7f5ff] shadow-none" : "border-0 bg-[#050b18] shadow-none"
      }`
    : `site-topology-flow relative h-full min-h-[520px] w-full overflow-hidden rounded-2xl ${
        isDay
          ? "border border-sky-200/80 bg-[#e7f5ff] shadow-[0_16px_40px_rgba(14,116,144,0.18)]"
          : "border border-slate-800/70 bg-[#050b18] shadow-[0_16px_56px_rgba(2,6,23,0.45)]"
      }`;

  const chartCardClass = isDay
    ? "border border-sky-200/90 bg-white/90 shadow-[0_8px_20px_rgba(14,116,144,0.12)]"
    : "border border-cyan-500/30 bg-slate-900/72 shadow-[0_10px_24px_rgba(2,6,23,0.42)]";

  return (
    <div className={containerClass}>
      <div className="relative z-10 flex h-full gap-3 p-3">
        <aside ref={chartsContainerRef} className="grid h-full w-[20%] shrink-0 min-w-[320px] grid-rows-4 gap-3 pr-1">
          <div className={`flex min-h-0 flex-col rounded-xl p-2 ${chartCardClass}`}>
            <div className="mb-1 px-2">
              <p className={`text-xs font-semibold tracking-[0.08em] uppercase ${isDay ? "text-slate-600" : "text-slate-400"}`}>辐照曲线</p>
            </div>
            <HighchartsReact highcharts={Highcharts} options={irradianceOptions} />
          </div>

          <div className={`flex min-h-0 flex-col rounded-xl p-2 ${chartCardClass}`}>
            <div className="mb-1 px-2">
              <p className={`text-xs font-semibold tracking-[0.08em] uppercase ${isDay ? "text-slate-600" : "text-slate-400"}`}>风速曲线</p>
            </div>
            <HighchartsReact highcharts={Highcharts} options={windOptions} />
          </div>

          <div className={`flex min-h-0 flex-col rounded-xl p-2 ${chartCardClass}`}>
            <div className="mb-1 px-2">
              <p className={`text-xs font-semibold tracking-[0.08em] uppercase ${isDay ? "text-slate-600" : "text-slate-400"}`}>发电量</p>
            </div>
            <HighchartsReact highcharts={Highcharts} options={generationOptions} />
          </div>

          <div className={`flex min-h-0 flex-col rounded-xl p-2 ${chartCardClass}`}>
            <div className="mb-1 px-2">
              <p className={`text-xs font-semibold tracking-[0.08em] uppercase ${isDay ? "text-slate-600" : "text-slate-400"}`}>
                储能电柜运行情况
              </p>
            </div>
            <HighchartsReact highcharts={Highcharts} options={storageRuntimeOptions} />
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-700/45 bg-transparent">
          <div
            className={`pointer-events-none absolute inset-0 z-0 ${
              isDay
                ? "bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.28),transparent_34%),radial-gradient(circle_at_88%_80%,rgba(132,204,22,0.18),transparent_30%),linear-gradient(180deg,#dbeafe_0%,#f0fdf4_58%,#ecfccb_100%)]"
                : "bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_82%_78%,rgba(34,197,94,0.14),transparent_30%),linear-gradient(180deg,#081225_0%,#050b18_100%)]"
            }`}
          />
          <div
            className={`pointer-events-none absolute top-3 left-3 z-20 rounded-xl px-4 py-3 backdrop-blur-sm ${
              isDay ? "border border-sky-200/90 bg-white/85" : "border border-cyan-400/30 bg-slate-900/75"
            }`}
          >
            <p className={`text-xs font-medium tracking-[0.08em] uppercase ${isDay ? "text-sky-700" : "text-cyan-300"}`}>
              {isDay ? "Solar Plant Aerial Map" : "Site Digital Twin"}
            </p>
            <p className={`mt-1 text-sm font-semibold ${isDay ? "text-slate-900" : "text-slate-100"}`}>场站 2D 设备分布视图</p>
            <p className={`mt-1 text-xs ${isDay ? "text-slate-600" : "text-slate-400"}`}>NCU 6分区矩阵排布 + 储能电柜横向排布</p>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              const nodeData = node.data as TopologyNodeData | undefined;

              if (nodeData?.kind === "ncu" && nodeData.hasWorkOrder) {
                router.push(`/sites/${siteId}/devices/inverter-b`);
              }
            }}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            style={{ background: "transparent" }}
          >
            <Controls showInteractive={false} />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color={isDay ? "rgba(51,65,85,0.18)" : "rgba(148,163,184,0.25)"}
            />

            <Panel position="bottom-left">
              <div
                className={`rounded-xl px-4 py-3 text-xs backdrop-blur-sm ${
                  isDay
                    ? "border border-slate-300/80 bg-white/90 text-slate-700"
                    : "border border-slate-700/70 bg-slate-950/70 text-slate-200"
                }`}
              >
                <div className={`mb-2 font-semibold tracking-wide ${isDay ? "text-slate-800" : "text-slate-100"}`}>状态统计</div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  NCU正常 {ncuStatusSummary.normal}
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  告警 {ncuStatusSummary.warning}
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                  异常 {ncuStatusSummary.error}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                  &lt;30°C {storageTempSummary.blue}
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                  30-60°C {storageTempSummary.yellow}
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                  60-80°C {storageTempSummary.orange}
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  &gt;80°C {storageTempSummary.red}
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </section>
      </div>

      <div
        className={`absolute top-5 right-5 z-20 flex items-center gap-2 rounded-xl p-1 shadow-sm backdrop-blur-sm ${
          isDay ? "border border-sky-200/90 bg-white/88" : "border border-slate-700/70 bg-slate-900/85"
        }`}
      >
        <button
          type="button"
          onClick={() => setVisualTheme("night")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            visualTheme === "night"
              ? "bg-cyan-500/25 text-cyan-300"
              : isDay
                ? "text-slate-700 hover:bg-sky-100"
                : "text-slate-300 hover:bg-slate-700/60"
          }`}
        >
          夜间科技
        </button>
        <button
          type="button"
          onClick={() => setVisualTheme("day")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            visualTheme === "day"
              ? "bg-sky-500/25 text-sky-700"
              : isDay
                ? "text-slate-700 hover:bg-sky-100"
                : "text-slate-300 hover:bg-slate-700/60"
          }`}
        >
          白天航拍
        </button>
        <div className={`mx-1 h-4 w-px ${isDay ? "bg-slate-300" : "bg-slate-700"}`} />
        <button
          type="button"
          onClick={() => setStatusMode("normal")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            statusMode === "normal"
              ? isDay
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-500/25 text-emerald-300"
              : isDay
                ? "text-slate-700 hover:bg-sky-100"
                : "text-slate-300 hover:bg-slate-700/60"
          }`}
        >
          全正常
        </button>
        <button
          type="button"
          onClick={() => setStatusMode("demo")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            statusMode === "demo"
              ? isDay
                ? "bg-orange-100 text-orange-700"
                : "bg-orange-500/25 text-orange-300"
              : isDay
                ? "text-slate-700 hover:bg-sky-100"
                : "text-slate-300 hover:bg-slate-700/60"
          }`}
        >
          随机演示
        </button>
        {statusMode === "demo" ? (
          <button
            type="button"
            onClick={() => setRefreshNonce((value) => value + 1)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              isDay ? "text-slate-700 hover:bg-sky-100" : "text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            刷新
          </button>
        ) : null}
      </div>

      <style jsx global>{`
        .site-topology-flow .react-flow__handle {
          display: none;
        }

        .site-topology-flow .react-flow__controls {
          border-radius: 10px;
          border: 1px solid ${isDay ? "rgba(148,163,184,0.8)" : "rgba(71, 85, 105, 0.7)"};
          overflow: hidden;
        }

        .site-topology-flow .react-flow__controls button {
          background: ${isDay ? "rgba(255,255,255,0.96)" : "rgba(15, 23, 42, 0.85)"};
          color: ${isDay ? "#0f172a" : "#e2e8f0"};
          border-bottom-color: ${isDay ? "rgba(148,163,184,0.8)" : "rgba(71, 85, 105, 0.7)"};
        }

        .site-topology-flow .react-flow__controls button:hover {
          background: ${isDay ? "rgba(241,245,249,0.98)" : "rgba(30, 41, 59, 0.95)"};
        }
      `}</style>
    </div>
  );
}
