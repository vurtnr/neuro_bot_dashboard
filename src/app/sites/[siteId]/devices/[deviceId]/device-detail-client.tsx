"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  captureWorkOrderSnapshot,
  completeWorkOrder,
  manualAngleControl,
} from "@/lib/robot-inspection/client";
import {
  clearPatrolSession,
  getPatrolSessionForSite,
  matchesPatrolLockedDevice,
} from "@/lib/robot-inspection/patrol-session";
import {
  getRobotCameraEmbeddedViewerPath,
  getRobotVideoBaseUrl,
} from "@/lib/robot-inspection/config";
import {
  isWorkOrderResolved,
  markWorkOrderResolved,
} from "@/lib/work-order-resolution";
import { createUuid } from "@/lib/uuid";

type DeviceDetailClientProps = {
  siteId: string;
  siteName: string;
  hasWarning: boolean;
};

type NodeDeviceType = "ncu" | "cabinet";

type DeviceMetric = {
  label: string;
  value: string;
  trend: string;
};

type InspectionAngleSnapshot = {
  actualAngle: number;
  targetAngle: number;
};

type RegionPreview = {
  title: string;
  description: string;
  variant: "thermal" | "terminal" | "pcs";
};

type CameraEvidence = {
  id: string;
  title: string;
  note: string;
  time: string;
  imageSrc: string;
  size: string;
};

type WorkOrderFormValues = {
  faultComponent: string;
  faultMode: string;
  diagnosis: string;
  repairAction: string;
  partName: string;
};

type WorkOrderStatus = "pending" | "completed";

type DrawerMode = "current" | "history";

type WorkOrderRecord = {
  id: string;
  orderNo: string;
  priority: "高优先级" | "中优先级";
  status: WorkOrderStatus;
  createdAt: string;
  completedAt?: string;
  faultComponent: string;
  faultMode: string;
  diagnosis: string;
  repairAction: string;
  partName: string;
  evidence: CameraEvidence[];
  source: DrawerMode;
};

type SubmitDialogTone = "warning" | "error";

type SubmitDialogState = {
  open: boolean;
  title: string;
  message: string;
  tone: SubmitDialogTone;
};

type RequiredWorkOrderField =
  | "evidence"
  | "diagnosis"
  | "repairAction"
  | "manualAngle";

type ManualAngleDirection = "west" | "east";

type ManualAngleFeedback = {
  direction: ManualAngleDirection;
  actualAngleUsed: number;
  verifiedActualAngle: number;
  verifiedChanged: boolean;
  targetAngle: number;
  deltaAngleUsed: number;
  message: string;
};

const WORK_ORDER_STATUS_META: Record<
  WorkOrderStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "待处理",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  completed: {
    label: "已处理",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

const REQUIRED_WORK_ORDER_FIELD_LABELS: Record<RequiredWorkOrderField, string> = {
  evidence: "证据与照片",
  diagnosis: "故障诊断",
  repairAction: "维修操作",
  manualAngle: "姿态纠偏",
};

const PHOTOVOLTAIC_FAULT_COMPONENT = "姿态控制机构";
const PHOTOVOLTAIC_FAULT_MODE = "角度偏差影响发电效率";

const INITIAL_SUBMIT_DIALOG_STATE: SubmitDialogState = {
  open: false,
  title: "",
  message: "",
  tone: "warning",
};

function parseDeviceType(value: string | null): NodeDeviceType {
  return value === "cabinet" ? "cabinet" : "ncu";
}

function parseAngleSearchParam(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Number(parsed.toFixed(1));
}

function buildMetrics(
  type: NodeDeviceType,
  seed: number,
  hasWarning: boolean,
  angleSnapshot?: InspectionAngleSnapshot | null,
): DeviceMetric[] {
  if (type === "cabinet") {
    const soc = Math.max(12, Math.min(96, 76 - (seed % 9) * 4));
    const temperature = (34 + (seed % 7) * 4.3).toFixed(1);
    const current = (88 + (seed % 6) * 11.6).toFixed(1);
    const voltage = (706 + (seed % 8) * 9.2).toFixed(1);
    const power = (2.1 + (seed % 5) * 0.7).toFixed(2);

    return [
      { label: "SOC", value: `${soc}%`, trend: soc < 30 ? "低电量关注" : "电量健康" },
      { label: "电池温度", value: `${temperature} °C`, trend: Number(temperature) > 60 ? "温升告警" : "温度稳定" },
      { label: "簇电流", value: `${current} A`, trend: hasWarning ? "电流波动" : "波动正常" },
      { label: "簇电压", value: `${voltage} V`, trend: "电压平稳" },
      { label: "充/放电功率", value: `${power} MW`, trend: "策略执行中" },
      { label: "SOH", value: `${Math.max(72, 96 - (seed % 10) * 2)}%`, trend: "寿命可控" },
    ];
  }

  const actualAngleValue =
    angleSnapshot?.actualAngle ?? Number((15 + (seed % 12) * 2.1).toFixed(1));
  const targetAngleValue =
    angleSnapshot?.targetAngle ??
    Number((actualAngleValue + (seed % 3 === 0 ? 1.2 : -0.8)).toFixed(1));
  const actualAngle = actualAngleValue.toFixed(1);
  const targetAngle = targetAngleValue.toFixed(1);
  const motorCurrent = (2.3 + (seed % 8) * 0.34).toFixed(2);
  const motorVoltage = (24.4 + (seed % 6) * 0.8).toFixed(1);
  const hasLiveAngles = Boolean(angleSnapshot);

  return [
    {
      label: "实际角度",
      value: `${actualAngle}°`,
      trend: hasLiveAngles ? "设备实测" : "实时追日",
    },
    {
      label: "目标角度",
      value: `${targetAngle}°`,
      trend: hasLiveAngles ? "控制器回传" : "模型下发",
    },
    { label: "电机电流", value: `${motorCurrent} A`, trend: hasWarning ? "扭矩偏高" : "负载正常" },
    { label: "电机电压", value: `${motorVoltage} V`, trend: "驱动稳定" },
    {
      label: "跟踪偏差",
      value: `${Math.abs(actualAngleValue - targetAngleValue).toFixed(1)}°`,
      trend: hasLiveAngles ? "查询回传" : "闭环修正中",
    },
    { label: "工作模式", value: "自动模式", trend: "已联动辐照策略" },
  ];
}

function buildTimeline(type: NodeDeviceType, hasWarning: boolean): string[] {
  if (type === "cabinet") {
    return hasWarning
      ? [
          "14:20 电池簇 BMS 触发温升告警",
          "14:16 PCS 下发降载指令 8%",
          "14:12 远程巡检任务已派发",
        ]
      : [
          "14:20 BMS 数据采集完成",
          "14:16 充放电策略执行中",
          "14:12 温度分布均衡",
        ];
  }

  return hasWarning
    ? [
        "14:20 支架驱动电流短时抬升",
        "14:16 跟踪偏差达 2.1°，已修正",
        "14:12 机器人巡检路径已生成",
      ]
    : [
        "14:20 支架自动对日完成",
        "14:16 跟踪偏差维持在 0.6°",
        "14:12 电机运行状态稳定",
      ];
}

function buildRegionPreviews(type: NodeDeviceType): RegionPreview[] {
  if (type === "cabinet") {
    return [
      {
        title: "簇温升区域",
        description: "Canvas 模拟热成像温升斑块",
        variant: "thermal",
      },
      {
        title: "接线端子",
        description: "Canvas 模拟端子排与接线压接点",
        variant: "terminal",
      },
      {
        title: "PCS接口位",
        description: "Canvas 模拟接口面板与连接区",
        variant: "pcs",
      },
    ];
  }

  return [
    {
      title: "驱动电机温升区",
      description: "Canvas 模拟电机外壳热区",
      variant: "thermal",
    },
    {
      title: "接线端子",
      description: "Canvas 模拟驱动线束连接端",
      variant: "terminal",
    },
    {
      title: "控制接口位",
      description: "Canvas 模拟控制接口与固定点",
      variant: "pcs",
    },
  ];
}

function buildFaultComponentOptions(type: NodeDeviceType): string[] {
  return type === "cabinet"
    ? ["", "簇温升区域", "接线端子", "PCS接口位"]
    : ["", PHOTOVOLTAIC_FAULT_COMPONENT, "驱动电机", "接线端子", "控制接口位"];
}

function buildFaultModeOptions(type: NodeDeviceType): string[] {
  return type === "cabinet"
    ? ["", "局部温升异常", "接触不良", "接口位热衰减"]
    : ["", PHOTOVOLTAIC_FAULT_MODE, "热异常", "接触不良", "姿态控制偏差"];
}

function buildMockWorkOrderForm(
  type: NodeDeviceType,
  nodeLabel: string,
  capturedAt: string,
): WorkOrderFormValues {
  const readableTime = formatCaptureTime(capturedAt);
  if (type === "cabinet") {
    return {
      faultComponent: "簇温升区域",
      faultMode: "局部温升异常",
      diagnosis: `${readableTime} 抓拍结果显示 ${nodeLabel} 电柜内存在局部热点，温升集中在电池簇连接区，疑似由接触电阻增大引起。建议结合红外测温和扭矩复核继续确认。`,
      repairAction: "已安排对热点连接点进行复紧和绝缘复核，并复测温度变化；若温升持续，则更换对应连接件。",
      partName: "储能簇连接端子组件",
    };
  }

  return {
    faultComponent: PHOTOVOLTAIC_FAULT_COMPONENT,
    faultMode: PHOTOVOLTAIC_FAULT_MODE,
    diagnosis: `${readableTime} 抓拍结果显示 ${nodeLabel} 当前姿态角度与目标跟踪角度存在偏差，已影响发电效率与对日响应稳定性。建议先执行一次姿态纠偏，再复核支架跟踪状态。`,
    repairAction: "建议先执行一次手动向西或向东姿态纠偏，并在纠偏后复核支架跟踪偏差、驱动响应与发电恢复情况。",
    partName: "姿态控制机构组件",
  };
}

function createEmptyWorkOrderForm(): WorkOrderFormValues {
  return {
    faultComponent: "",
    faultMode: "",
    diagnosis: "",
    repairAction: "",
    partName: "",
  };
}

function normalizeWorkOrderFormValues(
  values: WorkOrderFormValues,
): WorkOrderFormValues {
  return {
    faultComponent: values.faultComponent.trim(),
    faultMode: values.faultMode.trim(),
    diagnosis: values.diagnosis.trim(),
    repairAction: values.repairAction.trim(),
    partName: values.partName.trim(),
  };
}

function getMissingWorkOrderFields(
  values: WorkOrderFormValues,
  evidence: CameraEvidence[],
  type: NodeDeviceType,
  hasManualAngleFeedback: boolean,
): RequiredWorkOrderField[] {
  const normalizedValues = normalizeWorkOrderFormValues(values);
  const missingFields: RequiredWorkOrderField[] = [];

  if (evidence.length === 0) {
    missingFields.push("evidence");
  }
  if (!normalizedValues.diagnosis) {
    missingFields.push("diagnosis");
  }
  if (!normalizedValues.repairAction) {
    missingFields.push("repairAction");
  }
  if (type !== "cabinet" && evidence.length > 0 && !hasManualAngleFeedback) {
    missingFields.push("manualAngle");
  }

  return missingFields;
}

function buildSubmitDialogState(
  missingFields: RequiredWorkOrderField[],
): SubmitDialogState {
  const missingFieldLabels = missingFields.map(
    (field) => REQUIRED_WORK_ORDER_FIELD_LABELS[field],
  );
  const noEvidence = missingFields.includes("evidence");
  const noDiagnosis = missingFields.includes("diagnosis");
  const noRepairAction = missingFields.includes("repairAction");
  const noManualAngle = missingFields.includes("manualAngle");

  if (noEvidence && noDiagnosis && noRepairAction) {
    return {
      open: true,
      title: "请先完成机器人取证",
      message:
        "当前工单尚未进行机器人抓拍，诊断与维修信息也未填写。请先完成现场抓拍并补全必填项后再提交。",
      tone: "warning",
    };
  }

  if (missingFields.length === 1 && missingFields[0] === "evidence") {
    return {
      open: true,
      title: "请先完成现场取证",
      message:
        "当前工单还没有机器人抓拍照片。请先执行抓拍，确认照片已回传到证据区后，再提交处理结果。",
      tone: "warning",
    };
  }

  if (noManualAngle) {
    const remainingFieldLabels = missingFieldLabels.filter(
      (label) => label !== REQUIRED_WORK_ORDER_FIELD_LABELS.manualAngle,
    );

    return {
      open: true,
      title: "请先完成姿态纠偏",
      message:
        remainingFieldLabels.length > 0
          ? `当前支架工单已完成抓拍，但尚未执行姿态纠偏。请先下发一次手动向西或向东指令，并补全以下内容：${remainingFieldLabels.join("、")}。`
          : "当前支架工单已完成抓拍，但尚未执行姿态纠偏。请先下发一次手动向西或向东指令，确认机器人已完成姿态调整后再提交处理结果。",
      tone: "warning",
    };
  }

  return {
    open: true,
    title: "无法提交处理结果",
    message: `请先补全以下必填内容：${missingFieldLabels.join("、")}。`,
    tone: "warning",
  };
}

function RequiredLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-semibold text-slate-600">
      {children}
      <span className="ml-1 text-rose-500">*</span>
    </span>
  );
}

function buildRelativeTimestamp(dayOffset: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function buildWorkOrderPreviewImage(
  title: string,
  accent: string,
  subtitle: string,
): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="accent" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#f8fafc" stop-opacity="0.12" />
        </linearGradient>
      </defs>
      <rect width="640" height="480" fill="url(#bg)" />
      <rect x="30" y="24" width="580" height="326" rx="24" fill="#020617" stroke="#334155" stroke-width="2" />
      <rect x="54" y="52" width="220" height="124" rx="16" fill="url(#accent)" opacity="0.92" />
      <rect x="290" y="52" width="282" height="196" rx="18" fill="#111827" stroke="#1f2937" />
      <circle cx="170" cy="260" r="68" fill="${accent}" opacity="0.85" />
      <circle cx="170" cy="260" r="34" fill="#fde68a" opacity="0.7" />
      <rect x="288" y="270" width="288" height="18" rx="9" fill="#334155" />
      <rect x="288" y="302" width="220" height="14" rx="7" fill="#475569" />
      <rect x="54" y="384" width="210" height="18" rx="9" fill="#1e293b" />
      <rect x="54" y="414" width="328" height="12" rx="6" fill="#334155" />
      <text x="54" y="96" fill="#e2e8f0" font-size="32" font-family="Arial, sans-serif" font-weight="700">${title}</text>
      <text x="54" y="136" fill="#cbd5e1" font-size="18" font-family="Arial, sans-serif">${subtitle}</text>
      <text x="54" y="446" fill="#94a3b8" font-size="16" font-family="Arial, sans-serif">ROBOT INSPECTION FRAME</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createMockEvidence(
  title: string,
  time: string,
  accent: string,
  subtitle: string,
): CameraEvidence {
  return {
    id: createUuid(),
    title,
    note: `机器人现场巡检抓拍，记录 ${subtitle.toLowerCase()} 状态`,
    time: formatCaptureTime(time),
    imageSrc: buildWorkOrderPreviewImage(title, accent, subtitle),
    size: "640 x 480",
  };
}

function buildCurrentWorkOrderMeta(seed: number) {
  const orderSuffix = String(8600 + seed).padStart(4, "0");
  return {
    orderNo: `WO-2026-${orderSuffix}`,
    createdAt: buildRelativeTimestamp(0, 9 + (seed % 3), 12 + (seed % 5)),
    priority: seed % 2 === 0 ? "高优先级" : "中优先级",
  } as const;
}

function buildMockWorkOrderHistory(
  type: NodeDeviceType,
  nodeLabel: string,
  seed: number,
): WorkOrderRecord[] {
  const dayOffsets = [2, 6, 11];

  if (type === "cabinet") {
    const entries = [
      {
        faultComponent: "簇温升区域",
        faultMode: "局部温升异常",
        diagnosis: `${nodeLabel} 电池簇连接区出现连续温升，疑似紧固力衰减导致接触电阻偏高。`,
        repairAction: "完成连接点复紧、绝缘检查及复测，温升恢复至阈值内。",
        partName: "储能簇连接端子组件",
        accent: "#fb7185",
        subtitle: "THERMAL ZONE",
      },
      {
        faultComponent: "接线端子",
        faultMode: "接触不良",
        diagnosis: `${nodeLabel} 端子排存在局部氧化痕迹，压接处阻抗偏高。`,
        repairAction: "更换受损端子并重新压接，复测后电流波动消失。",
        partName: "端子排压接组件",
        accent: "#38bdf8",
        subtitle: "TERMINAL CHECK",
      },
      {
        faultComponent: "PCS接口位",
        faultMode: "接口位热衰减",
        diagnosis: `${nodeLabel} PCS 接口位周边温差增大，疑似插接老化。`,
        repairAction: "完成接口复位与热像复核，运行参数恢复稳定。",
        partName: "PCS 通讯接口模块",
        accent: "#f59e0b",
        subtitle: "PCS PORT",
      },
    ];

    return entries.map((entry, index) => {
      const createdAt = buildRelativeTimestamp(dayOffsets[index], 10 + index, 18);
      const completedAt = buildRelativeTimestamp(dayOffsets[index], 12 + index, 42);

      return {
        id: createUuid(),
        orderNo: `WO-2026-${String(8200 + seed + index).padStart(4, "0")}`,
        priority: index === 0 ? "高优先级" : "中优先级",
        status: "completed",
        createdAt,
        completedAt,
        faultComponent: entry.faultComponent,
        faultMode: entry.faultMode,
        diagnosis: entry.diagnosis,
        repairAction: entry.repairAction,
        partName: entry.partName,
        evidence: [
          createMockEvidence(
            `${nodeLabel} 历史工单抓拍`,
            completedAt,
            entry.accent,
            entry.subtitle,
          ),
        ],
        source: "history",
      };
    });
  }

  const entries = [
    {
      faultComponent: "驱动电机",
      faultMode: "热异常",
      diagnosis: `${nodeLabel} 驱动区壳体温度升高，伴随姿态响应滞后。`,
      repairAction: "完成驱动机构紧固与散热通道清理，复测后温升回落。",
      partName: "驱动电机组件",
      accent: "#fb7185",
      subtitle: "DRIVE MOTOR",
    },
    {
      faultComponent: "接线端子",
      faultMode: "接触不良",
      diagnosis: `${nodeLabel} 线束端子处存在短时抖动，疑似压接松动。`,
      repairAction: "重新压接端子并加固线束，电流曲线恢复平稳。",
      partName: "驱动线束端子",
      accent: "#38bdf8",
      subtitle: "WIRING TERMINAL",
    },
    {
      faultComponent: "控制接口位",
      faultMode: "姿态控制偏差",
      diagnosis: `${nodeLabel} 控制接口通讯偶发超时，导致目标角度下发滞后。`,
      repairAction: "完成接口重插、通讯复核与固定件更换。",
      partName: "控制接口板",
      accent: "#f59e0b",
      subtitle: "CONTROL PORT",
    },
  ];

  return entries.map((entry, index) => {
    const createdAt = buildRelativeTimestamp(dayOffsets[index], 8 + index, 26);
    const completedAt = buildRelativeTimestamp(dayOffsets[index], 11 + index, 8);

    return {
      id: createUuid(),
      orderNo: `WO-2026-${String(8100 + seed + index).padStart(4, "0")}`,
      priority: index === 0 ? "高优先级" : "中优先级",
      status: "completed",
      createdAt,
      completedAt,
      faultComponent: entry.faultComponent,
      faultMode: entry.faultMode,
      diagnosis: entry.diagnosis,
      repairAction: entry.repairAction,
      partName: entry.partName,
      evidence: [
        createMockEvidence(
          `${nodeLabel} 历史工单抓拍`,
          completedAt,
          entry.accent,
          entry.subtitle,
        ),
      ],
      source: "history",
    };
  });
}

function summarizeText(value: string, maxLength = 48): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function formatCaptureTime(value?: string): string {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RegionPreviewCanvas({
  title,
  description,
  variant,
}: RegionPreview) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;

    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#0f172a");
    background.addColorStop(1, "#1e293b");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(148, 163, 184, 0.22)";
    context.lineWidth = 1;
    for (let index = 0; index < 6; index += 1) {
      const y = 14 + index * 18;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    if (variant === "thermal") {
      const heat = context.createRadialGradient(86, 54, 10, 86, 54, 58);
      heat.addColorStop(0, "rgba(248, 113, 113, 0.98)");
      heat.addColorStop(0.45, "rgba(251, 191, 36, 0.9)");
      heat.addColorStop(1, "rgba(15, 23, 42, 0)");
      context.fillStyle = heat;
      context.beginPath();
      context.arc(86, 54, 58, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "rgba(56, 189, 248, 0.26)";
      context.fillRect(138, 20, 72, 72);
      context.strokeStyle = "rgba(248, 113, 113, 0.9)";
      context.lineWidth = 2;
      context.strokeRect(56, 26, 54, 44);
    } else if (variant === "terminal") {
      context.fillStyle = "#cbd5e1";
      context.fillRect(30, 26, 170, 44);
      context.fillStyle = "#475569";
      for (let index = 0; index < 6; index += 1) {
        context.fillRect(42 + index * 24, 34, 12, 28);
      }
      context.strokeStyle = "#38bdf8";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(20, 86);
      context.bezierCurveTo(66, 56, 84, 96, 130, 74);
      context.bezierCurveTo(160, 60, 182, 72, 220, 50);
      context.stroke();
    } else {
      context.fillStyle = "#0f172a";
      context.fillRect(34, 18, 168, 72);
      context.strokeStyle = "#94a3b8";
      context.lineWidth = 2;
      context.strokeRect(34, 18, 168, 72);
      context.fillStyle = "#1e293b";
      context.fillRect(52, 34, 132, 36);
      context.fillStyle = "#22d3ee";
      context.fillRect(64, 44, 34, 16);
      context.fillRect(106, 44, 34, 16);
      context.fillRect(148, 44, 20, 16);
      context.strokeStyle = "#f97316";
      context.lineWidth = 2;
      context.strokeRect(146, 40, 28, 24);
    }

    context.fillStyle = "#e2e8f0";
    context.font = "600 12px sans-serif";
    context.fillText(title, 12, height - 18);
    context.fillStyle = "rgba(226, 232, 240, 0.7)";
    context.font = "10px sans-serif";
    context.fillText(description, 12, height - 6);
  }, [description, title, variant]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={108}
      className="h-[82px] w-full rounded-md border border-slate-700/70 bg-slate-900"
    />
  );
}

function ReadonlyField({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emphasis";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-sm ${
          tone === "emphasis" ? "font-semibold text-slate-800" : "text-slate-700"
        }`}
      >
        {value || "--"}
      </p>
    </div>
  );
}

function parseMetricNumber(value?: string): number | null {
  if (!value) {
    return null;
  }

  const matched = value.match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}

function validateManualAngleInput(value: string): { ok: true; deltaAngle?: number } | {
  ok: false;
  message: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      message: "请输入 0 到 90 之间的整数角度；留空时将默认按 10° 执行。",
    };
  }

  const deltaAngle = Number(trimmed);
  if (deltaAngle < 0 || deltaAngle > 90) {
    return {
      ok: false,
      message: "姿态调整角度超出范围，请输入 0 到 90 之间的整数。",
    };
  }

  return { ok: true, deltaAngle };
}

export default function DeviceDetailClient({
  siteId,
  siteName,
  hasWarning,
}: DeviceDetailClientProps) {
  const searchParams = useSearchParams();
  const nodeType = parseDeviceType(searchParams.get("nodeType"));
  const nodeLabel =
    searchParams.get("nodeLabel") ||
    (nodeType === "cabinet" ? "储能电柜 E1" : "N1");
  const nodeId = searchParams.get("nodeId") || nodeLabel;
  const returnTo = searchParams.get("returnTo") || `/sites/${siteId}/2d`;
  const actualAngleParam = searchParams.get("actualAngle");
  const targetAngleParam = searchParams.get("targetAngle");
  const requestedHasWorkOrder =
    searchParams.get("hasWorkOrder") === "0" ? false : true;
  const seed = Number((nodeId ?? nodeLabel).match(/\d+/)?.[0] ?? "1");
  const [resolvedWorkOrder, setResolvedWorkOrder] = useState(() =>
    isWorkOrderResolved(siteId, nodeId),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [capturePending, setCapturePending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitDialogState, setSubmitDialogState] = useState<SubmitDialogState>(
    INITIAL_SUBMIT_DIALOG_STATE,
  );
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("current");
  const [selectedHistoryOrder, setSelectedHistoryOrder] =
    useState<WorkOrderRecord | null>(null);
  const [workOrderHistory, setWorkOrderHistory] = useState<WorkOrderRecord[]>([]);
  const [manualAngleInput, setManualAngleInput] = useState("");
  const [manualAnglePending, setManualAnglePending] = useState(false);
  const [manualAngleFeedback, setManualAngleFeedback] =
    useState<ManualAngleFeedback | null>(null);
  const [captureCooldownActive, setCaptureCooldownActive] = useState(false);
  const captureCooldownTimerRef = useRef<number | null>(null);
  const hasWorkOrder = requestedHasWorkOrder && !resolvedWorkOrder;
  const [currentOrderStatus, setCurrentOrderStatus] = useState<WorkOrderStatus>(
    hasWorkOrder ? "pending" : "completed",
  );
  const inspectionAngleSnapshot = useMemo<InspectionAngleSnapshot | null>(() => {
    if (nodeType === "cabinet") {
      return null;
    }

    const actualAngle = parseAngleSearchParam(actualAngleParam);
    const targetAngle = parseAngleSearchParam(targetAngleParam);
    if (actualAngle === null || targetAngle === null) {
      return null;
    }

    return {
      actualAngle,
      targetAngle,
    };
  }, [actualAngleParam, nodeType, targetAngleParam]);
  const metrics = useMemo(
    () => buildMetrics(nodeType, seed, hasWarning, inspectionAngleSnapshot),
    [hasWarning, inspectionAngleSnapshot, nodeType, seed],
  );
  const currentOrderMeta = useMemo(() => buildCurrentWorkOrderMeta(seed), [seed]);
  const cameraViewerFramePath = useMemo(
    () => getRobotCameraEmbeddedViewerPath(),
    [],
  );
  const cameraVideoBaseUrl = useMemo(() => getRobotVideoBaseUrl(), []);
  const regionPreviews = useMemo(() => buildRegionPreviews(nodeType), [nodeType]);
  const faultComponentOptions = useMemo(
    () => buildFaultComponentOptions(nodeType),
    [nodeType],
  );
  const faultModeOptions = useMemo(() => buildFaultModeOptions(nodeType), [nodeType]);
  const [cameraEvidence, setCameraEvidence] = useState<CameraEvidence[]>([]);
  const [formValues, setFormValues] = useState<WorkOrderFormValues>(
    createEmptyWorkOrderForm,
  );
  const currentOrderPending = currentOrderStatus === "pending";
  const manualAngleExecuted = manualAngleFeedback !== null;
  const missingRequiredFields = useMemo(
    () =>
      submitAttempted
        ? getMissingWorkOrderFields(
            formValues,
            cameraEvidence,
            nodeType,
            manualAngleExecuted,
          )
        : [],
    [cameraEvidence, formValues, manualAngleExecuted, nodeType, submitAttempted],
  );
  const missingRequiredFieldSet = useMemo(
    () => new Set<RequiredWorkOrderField>(missingRequiredFields),
    [missingRequiredFields],
  );

  useEffect(() => {
    const currentResolvedWorkOrder = isWorkOrderResolved(siteId, nodeId);
    const currentHasWorkOrder =
      requestedHasWorkOrder && !currentResolvedWorkOrder;

    setResolvedWorkOrder(currentResolvedWorkOrder);
    setCaptureError("");
    setCapturePending(false);
    setSubmitPending(false);
    setSubmitAttempted(false);
    setSubmitDialogState(INITIAL_SUBMIT_DIALOG_STATE);
    setCameraEvidence([]);
    setFormValues(createEmptyWorkOrderForm());
    setDrawerMode("current");
    setSelectedHistoryOrder(null);
    setDrawerOpen(false);
    setCurrentOrderStatus(currentHasWorkOrder ? "pending" : "completed");
    setWorkOrderHistory(buildMockWorkOrderHistory(nodeType, nodeLabel, seed));
    setManualAngleInput("");
    setManualAnglePending(false);
    setManualAngleFeedback(null);
    setCaptureCooldownActive(false);
    if (captureCooldownTimerRef.current) {
      window.clearTimeout(captureCooldownTimerRef.current);
      captureCooldownTimerRef.current = null;
    }
  }, [nodeId, nodeLabel, nodeType, requestedHasWorkOrder, seed, siteId]);

  useEffect(
    () => () => {
      if (captureCooldownTimerRef.current) {
        window.clearTimeout(captureCooldownTimerRef.current);
        captureCooldownTimerRef.current = null;
      }
    },
    [],
  );

  const timeline = useMemo(
    () => buildTimeline(nodeType, hasWarning || currentOrderPending),
    [nodeType, hasWarning, currentOrderPending],
  );
  const categories = useMemo(
    () => Array.from({ length: 12 }, (_, index) => `${index + 8}:00`),
    [],
  );
  const chartSeries = useMemo(() => {
    if (nodeType === "cabinet") {
      const socSeries = Array.from({ length: 12 }, (_, index) =>
        Number((76 - index * 1.8 + Math.sin((index + seed) / 2) * 3.2).toFixed(1)),
      );
      const tempSeries = Array.from({ length: 12 }, (_, index) =>
        Number((35 + index * 0.7 + Math.sin((index + seed) / 3) * 2.8).toFixed(1)),
      );
      const chargeSeries = Array.from({ length: 12 }, (_, index) =>
        Number((1.8 + Math.sin((index + seed) / 2.4) * 0.8).toFixed(2)),
      );
      const dischargeSeries = chargeSeries.map((value, index) =>
        Number((Math.max(0, value - 0.32 - ((index + seed) % 4) * 0.05)).toFixed(2)),
      );

      return {
        primaryMain: socSeries,
        primarySub: tempSeries,
        secondaryMain: chargeSeries,
        secondarySub: dischargeSeries,
      };
    }

    const actualAngleSeries = Array.from({ length: 12 }, (_, index) =>
      Number((18 + Math.sin((index + seed) / 2) * 7 + index * 0.4).toFixed(1)),
    );
    const targetAngleSeries = actualAngleSeries.map((value, index) =>
      Number((value + (index % 3 === 0 ? 1.2 : -0.9)).toFixed(1)),
    );
    const motorCurrentSeries = Array.from({ length: 12 }, (_, index) =>
      Number((2.2 + Math.sin((index + seed) / 2.1) * 0.9 + index * 0.06).toFixed(2)),
    );
    const motorVoltageSeries = Array.from({ length: 12 }, (_, index) =>
      Number((24.8 + Math.cos((index + seed) / 2.5) * 1.6).toFixed(1)),
    );

    return {
      primaryMain: actualAngleSeries,
      primarySub: targetAngleSeries,
      secondaryMain: motorCurrentSeries,
      secondarySub: motorVoltageSeries,
    };
  }, [nodeType, seed]);
  const primaryChartOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "line",
        height: 260,
        backgroundColor: "transparent",
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: true, itemStyle: { fontSize: "11px", color: "#334155" } },
      xAxis: {
        categories,
        tickLength: 0,
        lineColor: "rgba(148,163,184,0.35)",
        labels: { style: { color: "#64748b", fontSize: "10px" } },
      },
      yAxis: [
        {
          title: { text: undefined },
          gridLineColor: "rgba(148,163,184,0.16)",
          labels: { style: { color: "#64748b", fontSize: "10px" } },
        },
      ],
      tooltip: {
        shared: true,
        borderColor: "rgba(14,116,144,0.3)",
        backgroundColor: "rgba(255,255,255,0.96)",
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          lineWidth: 2.1,
        },
      },
      series: [
        {
          type: "line",
          name: nodeType === "cabinet" ? "SOC" : "实际角度",
          data: chartSeries.primaryMain,
          color: "#0284c7",
        },
        {
          type: "line",
          name: nodeType === "cabinet" ? "温度" : "目标角度",
          data: chartSeries.primarySub,
          color: "#f97316",
        },
      ],
    }),
    [categories, chartSeries.primaryMain, chartSeries.primarySub, nodeType],
  );
  const secondaryChartOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "areaspline",
        height: 260,
        backgroundColor: "transparent",
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: true, itemStyle: { fontSize: "11px", color: "#334155" } },
      xAxis: {
        categories,
        tickLength: 0,
        lineColor: "rgba(148,163,184,0.35)",
        labels: { style: { color: "#64748b", fontSize: "10px" } },
      },
      yAxis: [
        {
          title: { text: undefined },
          gridLineColor: "rgba(148,163,184,0.16)",
          labels: { style: { color: "#64748b", fontSize: "10px" } },
        },
      ],
      tooltip: {
        shared: true,
        borderColor: "rgba(14,116,144,0.3)",
        backgroundColor: "rgba(255,255,255,0.96)",
      },
      plotOptions: {
        areaspline: {
          marker: { enabled: false },
          lineWidth: 2,
          fillOpacity: 0.24,
        },
      },
      series: [
        {
          type: "areaspline",
          name: nodeType === "cabinet" ? "充电功率" : "电机电流",
          data: chartSeries.secondaryMain,
          color: "#22c55e",
        },
        {
          type: "areaspline",
          name: nodeType === "cabinet" ? "放电功率" : "电机电压",
          data: chartSeries.secondarySub,
          color: "#a855f7",
        },
      ],
    }),
    [categories, chartSeries.secondaryMain, chartSeries.secondarySub, nodeType],
  );
  const deviceTypeLabel = nodeType === "cabinet" ? "储能电柜节点" : "光伏支架节点";
  const statusLabel = hasWarning || currentOrderPending ? "异常关注" : "运行正常";
  const headlineStats = useMemo(
    () =>
      nodeType === "cabinet"
        ? [
            { label: "当前SOC", value: metrics[0]?.value ?? "--", tone: "text-emerald-600" },
            { label: "簇温度", value: metrics[1]?.value ?? "--", tone: "text-amber-600" },
            { label: "充放电", value: metrics[4]?.value ?? "--", tone: "text-sky-600" },
          ]
        : [
            { label: "实际角度", value: metrics[0]?.value ?? "--", tone: "text-sky-600" },
            { label: "跟踪偏差", value: metrics[4]?.value ?? "--", tone: "text-amber-600" },
            { label: "电机电流", value: metrics[2]?.value ?? "--", tone: "text-emerald-600" },
          ],
    [metrics, nodeType],
  );
  const latestHistoryOrder = workOrderHistory[0] ?? null;
  const currentOrderStatusMeta = WORK_ORDER_STATUS_META[currentOrderStatus];
  const isPhotovoltaicNode = nodeType !== "cabinet";
  const currentDiagnosisState = currentOrderPending
    ? isPhotovoltaicNode
      ? manualAngleExecuted
        ? "姿态纠偏已执行，待提交"
        : cameraEvidence.length > 0
          ? "已抓拍，待执行姿态纠偏"
          : "等待机器人抓拍"
      : formValues.diagnosis
        ? "诊断已生成，待提交"
        : cameraEvidence.length > 0
          ? "已抓拍，待填写处理结果"
          : "等待机器人抓拍"
    : latestHistoryOrder
      ? "已归档至历史工单"
      : "当前无待处理工单";
  const currentActualAngle =
    manualAngleFeedback?.verifiedActualAngle ?? parseMetricNumber(metrics[0]?.value);
  const captureActionDisabled =
    capturePending || submitPending || manualAnglePending || captureCooldownActive;
  const currentOrderRecord = useMemo<WorkOrderRecord>(
    () => ({
      id: `current-${nodeId}`,
      orderNo: currentOrderMeta.orderNo,
      priority: currentOrderMeta.priority,
      status: currentOrderStatus,
      createdAt: currentOrderMeta.createdAt,
      faultComponent: formValues.faultComponent,
      faultMode: formValues.faultMode,
      diagnosis: formValues.diagnosis,
      repairAction: formValues.repairAction,
      partName: formValues.partName,
      evidence: cameraEvidence,
      source: "current",
    }),
    [
      cameraEvidence,
      currentOrderMeta.createdAt,
      currentOrderMeta.orderNo,
      currentOrderMeta.priority,
      currentOrderStatus,
      formValues,
      nodeId,
    ],
  );
  const isHistoryDrawer = drawerMode === "history" && selectedHistoryOrder !== null;
  const manualAngleActionDisabled =
    !currentOrderPending ||
    isHistoryDrawer ||
    cameraEvidence.length === 0 ||
    capturePending ||
    submitPending ||
    manualAnglePending;
  const shouldShowPoseControlCard =
    isPhotovoltaicNode && !isHistoryDrawer && cameraEvidence.length > 0;
  const activeDrawerRecord = isHistoryDrawer ? selectedHistoryOrder : currentOrderRecord;
  const activeDrawerStatusMeta =
    WORK_ORDER_STATUS_META[activeDrawerRecord?.status ?? "completed"];
  const activeDrawerFormValues = isHistoryDrawer
    ? {
        faultComponent: selectedHistoryOrder?.faultComponent ?? "",
        faultMode: selectedHistoryOrder?.faultMode ?? "",
        diagnosis: selectedHistoryOrder?.diagnosis ?? "",
        repairAction: selectedHistoryOrder?.repairAction ?? "",
        partName: selectedHistoryOrder?.partName ?? "",
      }
    : formValues;
  const activeDrawerEvidence = isHistoryDrawer
    ? selectedHistoryOrder?.evidence ?? []
    : cameraEvidence;
  const activeDrawerPrimaryEvidence = activeDrawerEvidence[0] ?? null;
  const primaryActionDisabled = !currentOrderPending && latestHistoryOrder === null;
  const primaryActionLabel = currentOrderPending
    ? "处理当前工单"
    : latestHistoryOrder
      ? "查看最新工单"
      : "暂无工单";
  const showBackToSiteButton = !currentOrderPending && latestHistoryOrder !== null;

  function openCurrentWorkOrder() {
    setDrawerMode("current");
    setSelectedHistoryOrder(null);
    setDrawerOpen(true);
  }

  function openHistoryWorkOrder(record: WorkOrderRecord) {
    setDrawerMode("history");
    setSelectedHistoryOrder(record);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (submitPending) {
      return;
    }

    setDrawerOpen(false);
  }

  function closeSubmitDialog() {
    setSubmitDialogState(INITIAL_SUBMIT_DIALOG_STATE);
  }

  function handlePrimaryAction() {
    if (currentOrderPending) {
      openCurrentWorkOrder();
      return;
    }

    if (latestHistoryOrder) {
      openHistoryWorkOrder(latestHistoryOrder);
    }
  }

  async function handleCaptureSnapshot() {
    if (captureActionDisabled) {
      return;
    }

    setCapturePending(true);
    setCaptureError("");

    try {
      const response = await captureWorkOrderSnapshot({
        requestId: createUuid(),
        siteId,
        nodeId,
        nodeLabel,
      });

      const mimeType = response.mimeType || "image/jpeg";
      const imageBase64 = response.imageBase64 || "";
      const capturedAt = response.capturedAt || new Date().toISOString();
      if (!imageBase64) {
        throw new Error("机器人未返回抓拍图片");
      }
      const readableTime = formatCaptureTime(capturedAt);
      const imageSrc = `data:${mimeType};base64,${imageBase64}`;

      setCameraEvidence((current) => [
        {
          id: createUuid(),
          title: `${nodeLabel} 抓拍`,
          note: `机器人回传抓拍帧，分辨率 ${response.width ?? "--"}x${response.height ?? "--"}`,
          time: readableTime,
          imageSrc,
          size: `${response.width ?? "--"} x ${response.height ?? "--"}`,
        },
        ...current,
      ]);
      setFormValues(buildMockWorkOrderForm(nodeType, nodeLabel, capturedAt));
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "抓拍失败，请检查机器人服务。",
      );
    } finally {
      setCapturePending(false);
    }
  }

  async function handleManualAngleAction(direction: ManualAngleDirection) {
    if (manualAngleActionDisabled) {
      return;
    }

    const validation = validateManualAngleInput(manualAngleInput);
    if (!validation.ok) {
      setSubmitDialogState({
        open: true,
        title: "姿态调整参数无效",
        message: validation.message,
        tone: "warning",
      });
      return;
    }

    setManualAnglePending(true);

    try {
      const response = await manualAngleControl({
        requestId: createUuid(),
        siteId,
        nodeId,
        nodeLabel,
        direction,
        deltaAngle: validation.deltaAngle,
      });

      const actualAngleUsed =
        typeof response.actualAngleUsed === "number"
          ? response.actualAngleUsed
          : currentActualAngle ?? 0;
      const verifiedActualAngle =
        typeof response.verifiedActualAngle === "number"
          ? response.verifiedActualAngle
          : actualAngleUsed;
      const verifiedChanged = response.verifiedChanged ?? false;
      const targetAngle =
        typeof response.targetAngle === "number" ? response.targetAngle : 0;
      const deltaAngleUsed =
        typeof response.deltaAngleUsed === "number"
          ? response.deltaAngleUsed
          : validation.deltaAngle ?? 10;

      setManualAngleFeedback({
        direction,
        actualAngleUsed,
        verifiedActualAngle,
        verifiedChanged,
        targetAngle,
        deltaAngleUsed,
        message: response.message,
      });
      setCaptureCooldownActive(true);

      if (captureCooldownTimerRef.current) {
        window.clearTimeout(captureCooldownTimerRef.current);
      }
      captureCooldownTimerRef.current = window.setTimeout(() => {
        setCaptureCooldownActive(false);
        captureCooldownTimerRef.current = null;
      }, 2500);
    } catch (error) {
      setSubmitDialogState({
        open: true,
        title: "姿态调整未执行",
        message:
          error instanceof Error
            ? error.message
            : "机器人未能完成姿态调整，请检查设备连接状态后重试。",
        tone: "error",
      });
    } finally {
      setManualAnglePending(false);
    }
  }

  async function handleSubmitWorkOrder() {
    if (!currentOrderPending || submitPending) {
      return;
    }

    setSubmitAttempted(true);
    const missingFields = getMissingWorkOrderFields(
      formValues,
      cameraEvidence,
      nodeType,
      manualAngleExecuted,
    );
    if (missingFields.length > 0) {
      setSubmitDialogState(buildSubmitDialogState(missingFields));
      return;
    }

    const completedAt = new Date().toISOString();
    const resolvedFormValues = normalizeWorkOrderFormValues(formValues);
    const resolvedEvidence = cameraEvidence;

    const submittedRecord: WorkOrderRecord = {
      id: createUuid(),
      orderNo: currentOrderMeta.orderNo,
      priority: currentOrderMeta.priority,
      status: "completed",
      createdAt: currentOrderMeta.createdAt,
      completedAt,
      faultComponent: resolvedFormValues.faultComponent,
      faultMode: resolvedFormValues.faultMode,
      diagnosis: resolvedFormValues.diagnosis,
      repairAction: resolvedFormValues.repairAction,
      partName: resolvedFormValues.partName,
      evidence: resolvedEvidence,
      source: "history",
    };

    setSubmitPending(true);

    try {
      await completeWorkOrder({
        requestId: createUuid(),
        siteId,
        nodeId,
        nodeLabel,
      });

      const activePatrolSession = getPatrolSessionForSite(siteId);
      if (matchesPatrolLockedDevice(activePatrolSession, siteId, nodeId)) {
        clearPatrolSession(activePatrolSession?.requestId);
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 3000);
      });

      markWorkOrderResolved(siteId, nodeId);
      setResolvedWorkOrder(true);
      setFormValues(resolvedFormValues);
      setCameraEvidence(resolvedEvidence);
      setWorkOrderHistory((current) => [submittedRecord, ...current]);
      setCurrentOrderStatus("completed");
      setSelectedHistoryOrder(submittedRecord);
      setDrawerMode("history");
      setDrawerOpen(false);
      setSubmitAttempted(false);
      setSubmitDialogState(INITIAL_SUBMIT_DIALOG_STATE);
    } catch (error) {
      setSubmitDialogState({
        open: true,
        title: "机器人未确认收尾指令",
        message:
          error instanceof Error
            ? error.message
            : "机器人暂未确认工单收尾，请稍后重试。",
        tone: "error",
      });
    } finally {
      setSubmitPending(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_8%,#bfdbfe_0%,#e0f2fe_30%,#f8fafc_68%)] text-slate-900">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-col gap-4 p-4 md:p-6">
        <section className="rounded-2xl border border-sky-200/70 bg-white/90 p-4 shadow-[0_18px_42px_rgba(30,64,175,0.12)] backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-sky-700 uppercase">
                设备详情 · 实时态势
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-800">
                {siteName} / {nodeLabel}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 font-semibold text-sky-700">
                  {deviceTypeLabel}
                </span>
                <span
                  className={`rounded-full border px-2 py-1 font-semibold ${
                    hasWarning || currentOrderPending
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
            {showBackToSiteButton ? (
              <Link
                href={returnTo}
                className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-[0_10px_24px_rgba(14,116,144,0.12)] transition hover:border-sky-300 hover:bg-sky-100"
              >
                返回场站
              </Link>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {headlineStats.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-sky-100/80 bg-gradient-to-br from-white to-sky-50/60 px-3 py-2"
              >
                <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
                <p className={`mt-0.5 text-lg font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid min-h-0 flex-1 overflow-hidden grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)] backdrop-blur-sm"
                >
                  <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-800">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{metric.trend}</p>
                </article>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
                <p className="text-sm font-semibold text-slate-700">
                  {nodeType === "cabinet" ? "SOC / 温度趋势" : "角度跟踪趋势"}
                </p>
                <div className="mt-2">
                  <HighchartsReact highcharts={Highcharts} options={primaryChartOptions} />
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
                <p className="text-sm font-semibold text-slate-700">
                  {nodeType === "cabinet" ? "充放电功率趋势" : "电机电参趋势"}
                </p>
                <div className="mt-2">
                  <HighchartsReact highcharts={Highcharts} options={secondaryChartOptions} />
                </div>
              </article>
            </div>

            <article className="flex min-h-[220px] flex-1 flex-col rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">状态流水</p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                  {timeline.length} 条记录
                </span>
              </div>
              <div className="mt-3 grid flex-1 content-start grid-cols-1 gap-2">
                {timeline.map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="flex h-full min-h-0 flex-col gap-4">
            <article className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">设备运行画像</p>
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                    currentOrderPending
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {currentOrderPending ? "当前工单待处理" : "当前无待处理工单"}
                </span>
              </div>
              <div className="mt-3 rounded-xl border border-sky-100/80 bg-gradient-to-br from-sky-50/80 to-white p-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>类型</span>
                  <span className="font-semibold text-slate-800">{deviceTypeLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>工单状态</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      currentOrderPending
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {currentOrderPending ? "待处理" : "已归档"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>当前模式</span>
                  <span className="font-semibold text-slate-800">
                    {nodeType === "cabinet" ? "功率调度" : "追日跟踪"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>历史工单数</span>
                  <span className="font-semibold text-slate-800">{workOrderHistory.length}</span>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">当前工单摘要</p>
                  <p className="mt-1 text-xs text-slate-500">
                    当前待处理工单与机器人抓拍进度
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${currentOrderStatusMeta.className}`}
                >
                  {currentOrderStatusMeta.label}
                </span>
              </div>
              <div className="mt-3 rounded-xl border border-sky-100/80 bg-gradient-to-br from-white to-sky-50/70 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ReadonlyField
                    label="工单号"
                    value={currentOrderMeta.orderNo}
                    tone="emphasis"
                  />
                  <ReadonlyField
                    label="创建时间"
                    value={formatCaptureTime(currentOrderMeta.createdAt)}
                  />
                  <ReadonlyField
                    label="最近抓拍"
                    value={cameraEvidence[0]?.time ?? "未抓拍"}
                  />
                  <ReadonlyField
                    label="证据数量"
                    value={`${cameraEvidence.length} 张`}
                  />
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      {currentOrderMeta.priority}
                    </span>
                    {formValues.faultComponent ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                        {formValues.faultComponent}
                      </span>
                    ) : null}
                    {formValues.faultMode ? (
                      <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">
                        {formValues.faultMode}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    {currentDiagnosisState}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {currentOrderPending
                      ? "点击转处理工单可进入工单抽屉，抓拍与填写诊断结果。"
                      : latestHistoryOrder
                        ? `最近一次归档为 ${latestHistoryOrder.orderNo}，可在下方历史列表查看只读详情。`
                        : "当前设备暂无待处理工单。"}
                  </p>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    disabled={primaryActionDisabled}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      !primaryActionDisabled
                        ? "bg-sky-600 text-white shadow-[0_8px_20px_rgba(2,132,199,0.24)] hover:bg-sky-700"
                        : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    {currentOrderPending ? "转处理工单" : primaryActionLabel}
                  </button>
                </div>
              </div>
            </article>

            <article className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">工单处理历史</p>
                  <p className="mt-1 text-xs text-slate-500">
                    展示该设备的历史工单处理记录与机器人取证结果
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                  {workOrderHistory.length} 条
                </span>
              </div>
              <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                {workOrderHistory.map((record) => {
                  const preview = record.evidence[0];
                  const statusMeta = WORK_ORDER_STATUS_META[record.status];

                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => openHistoryWorkOrder(record)}
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-sky-200 hover:bg-sky-50/40"
                    >
                      <div className="h-[92px] w-[120px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preview.imageSrc}
                            alt={preview.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-slate-300">
                            暂无抓拍
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {record.orderNo}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              创建 {formatCaptureTime(record.createdAt)}
                              {record.completedAt
                                ? ` · 完成 ${formatCaptureTime(record.completedAt)}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                            {record.faultComponent}
                          </span>
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">
                            {record.faultMode}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {record.partName}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          诊断：{summarizeText(record.diagnosis, 44)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          处理：{summarizeText(record.repairAction, 42)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          </aside>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-300 ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeDrawer}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-full max-w-[620px] border-l border-slate-200 bg-slate-50 shadow-[-16px_0_32px_rgba(15,23,42,0.2)] transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-700">
                    {activeDrawerRecord?.priority ?? currentOrderMeta.priority}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 font-semibold ${activeDrawerStatusMeta.className}`}
                  >
                    {activeDrawerStatusMeta.label}
                  </span>
                  <span className="text-slate-500">
                    创建于：{formatCaptureTime(activeDrawerRecord?.createdAt)}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-slate-800">
                  {siteName} - {nodeLabel}
                  {isHistoryDrawer ? " 历史工单" : " 工单处理"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  工单号：{activeDrawerRecord?.orderNo ?? currentOrderMeta.orderNo}
                  {isHistoryDrawer && activeDrawerRecord?.completedAt
                    ? ` · 完成于 ${formatCaptureTime(activeDrawerRecord.completedAt)}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                关闭
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-800">
                  {isHistoryDrawer
                    ? "机器人现场记录"
                    : isPhotovoltaicNode
                      ? "机器人现场取证"
                      : "机器人摄像头回传"}
                </p>
                {isHistoryDrawer ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    只读归档
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {cameraVideoBaseUrl ? "实时流中" : "未配置"}
                  </span>
                )}
              </div>
              {isHistoryDrawer ? (
                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_162px]">
                  <div className="rounded-xl border border-slate-200 bg-slate-950 p-2 shadow-inner">
                    <div className="relative flex h-[210px] items-center justify-center overflow-hidden rounded-lg border border-slate-700/70 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.24),rgba(2,6,23,0.95))]">
                      <div className="absolute top-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                        ROBOT-ARCHIVE
                      </div>
                      <div className="absolute top-2 right-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                        {activeDrawerRecord?.completedAt
                          ? formatCaptureTime(activeDrawerRecord.completedAt)
                          : "历史归档"}
                      </div>
                      {activeDrawerPrimaryEvidence ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeDrawerPrimaryEvidence.imageSrc}
                          alt={activeDrawerPrimaryEvidence.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="px-6 text-center text-sm font-medium text-sky-100">
                          当前历史工单未归档机器人抓拍照片。
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] text-slate-200">
                        {siteName} / {nodeLabel}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1">
                        故障组件：{activeDrawerFormValues.faultComponent || "--"}
                      </div>
                      <div className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1">
                        故障模式：{activeDrawerFormValues.faultMode || "--"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <ReadonlyField
                      label="创建时间"
                      value={formatCaptureTime(activeDrawerRecord?.createdAt)}
                    />
                    <ReadonlyField
                      label="完成时间"
                      value={formatCaptureTime(activeDrawerRecord?.completedAt)}
                    />
                    <ReadonlyField
                      label="归档图片"
                      value={`${activeDrawerEvidence.length} 张`}
                    />
                  </div>
                </div>
              ) : (
                isPhotovoltaicNode ? (
                  <div className="mt-3 space-y-4">
                    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-cyan-50/45 p-4 shadow-[0_14px_28px_rgba(14,116,144,0.08)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">机器人现场取证</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            先完成机器人抓拍，系统将自动生成“角度偏差影响发电效率”的诊断结论，并在下方故障诊断区解锁姿态纠偏操作。
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                              cameraEvidence.length > 0
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-sky-200 bg-white text-sky-700"
                            }`}
                          >
                            {cameraEvidence.length > 0 ? "已抓拍" : "待抓拍"}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                              cameraVideoBaseUrl
                                ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                                : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {cameraVideoBaseUrl ? "实时流中" : "未配置"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          {
                            key: "capture",
                            label: "1 现场抓拍",
                            active: cameraEvidence.length === 0,
                            done: cameraEvidence.length > 0,
                          },
                          {
                            key: "adjust",
                            label: "2 姿态纠偏",
                            active: cameraEvidence.length > 0 && !manualAngleExecuted,
                            done: manualAngleExecuted,
                          },
                          {
                            key: "submit",
                            label: "3 提交归档",
                            active: manualAngleExecuted && currentOrderPending,
                            done: !currentOrderPending,
                          },
                        ].map((step) => (
                          <span
                            key={step.key}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              step.done
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : step.active
                                  ? "border-sky-200 bg-white text-sky-700"
                                  : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {step.label}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-2 shadow-inner">
                        <div className="relative flex h-[210px] items-center justify-center overflow-hidden rounded-lg border border-slate-700/70 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.24),rgba(2,6,23,0.95))]">
                          <div className="absolute top-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                            ROBOT-CAM-01
                          </div>
                          <div className="absolute top-2 right-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                            MJPEG · /camera_driver/image_raw
                          </div>
                          {drawerOpen && cameraVideoBaseUrl ? (
                            <iframe
                              key={`${nodeId}-${cameraViewerFramePath}`}
                              src={cameraViewerFramePath}
                              title={`${nodeLabel} 机器人实时画面`}
                              className="block h-full w-full border-0 bg-slate-950"
                              loading="eager"
                              scrolling="no"
                            />
                          ) : (
                            <div className="px-6 text-center text-sm font-medium text-sky-100">
                              {cameraVideoBaseUrl
                                ? "打开抽屉后将建立机器人实时视频连接。"
                                : "未配置机器人实时视频流地址，请检查 `NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL` 或 `NEXT_PUBLIC_ROBOT_BASE_URL`。"}
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] text-slate-200">
                            {siteName} / {nodeLabel}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-300">
                            {captureError
                              ? `抓拍异常：${captureError}`
                              : captureCooldownActive
                                ? "姿态调整指令已下发，等待支架稳定后再抓拍。"
                                : cameraEvidence.length > 0
                                  ? "抓拍结果已写入证据区，并自动生成姿态偏差诊断。"
                                  : `实时流地址：${cameraVideoBaseUrl || "未配置"}${cameraVideoBaseUrl ? "/stream?topic=/camera_driver/image_raw" : ""}`}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCaptureSnapshot}
                              disabled={captureActionDisabled}
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                captureActionDisabled
                                  ? "cursor-wait border-slate-700 bg-slate-700 text-slate-300"
                                  : "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                              }`}
                            >
                              {capturePending
                                ? "抓拍中..."
                                : manualAnglePending
                                  ? "调整中..."
                                  : submitPending
                                    ? "处理中..."
                                    : captureCooldownActive
                                      ? "等待姿态稳定..."
                                      : cameraEvidence.length > 0
                                        ? "重新抓拍"
                                        : "抓拍"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_162px]">
                    <div className="rounded-xl border border-slate-200 bg-slate-950 p-2 shadow-inner">
                      <div className="relative flex h-[210px] items-center justify-center overflow-hidden rounded-lg border border-slate-700/70 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.24),rgba(2,6,23,0.95))]">
                        <div className="absolute top-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                          ROBOT-CAM-01
                        </div>
                        <div className="absolute top-2 right-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                          MJPEG · /camera_driver/image_raw
                        </div>
                        {drawerOpen && cameraVideoBaseUrl ? (
                          <iframe
                            key={`${nodeId}-${cameraViewerFramePath}`}
                            src={cameraViewerFramePath}
                            title={`${nodeLabel} 机器人实时画面`}
                            className="block h-full w-full border-0 bg-slate-950"
                            loading="eager"
                            scrolling="no"
                          />
                        ) : (
                          <div className="px-6 text-center text-sm font-medium text-sky-100">
                            {cameraVideoBaseUrl
                              ? "打开抽屉后将建立机器人实时视频连接。"
                              : "未配置机器人实时视频流地址，请检查 `NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL` 或 `NEXT_PUBLIC_ROBOT_BASE_URL`。"}
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] text-slate-200">
                          {siteName} / {nodeLabel}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-300">
                          {captureError
                            ? `抓拍异常：${captureError}`
                            : `实时流地址：${cameraVideoBaseUrl || "未配置"}${cameraVideoBaseUrl ? "/stream?topic=/camera_driver/image_raw" : ""}`}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCaptureSnapshot}
                            disabled={capturePending || submitPending}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                              capturePending || submitPending
                                ? "cursor-wait border-slate-700 bg-slate-700 text-slate-300"
                                : "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                            }`}
                          >
                            {capturePending
                              ? "抓拍中..."
                              : submitPending
                                ? "处理中..."
                                : "抓拍"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {regionPreviews.map((preview) => (
                        <div
                          key={preview.title}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                        >
                          <RegionPreviewCanvas
                            title={preview.title}
                            description={preview.description}
                            variant={preview.variant}
                          />
                          <p className="mt-1 text-[10px] font-semibold text-slate-700">
                            模拟区域图
                          </p>
                          <p className="text-[10px] text-slate-500">{preview.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-lg font-semibold text-slate-800">故障诊断</p>
              {isHistoryDrawer ? (
                <>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ReadonlyField
                      label="故障组件"
                      value={activeDrawerFormValues.faultComponent}
                      tone="emphasis"
                    />
                    <ReadonlyField
                      label="故障模式"
                      value={activeDrawerFormValues.faultMode}
                      tone="emphasis"
                    />
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-600">诊断结果</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {activeDrawerFormValues.diagnosis || "--"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {shouldShowPoseControlCard ? (
                    <div
                      className={`mb-4 rounded-2xl border p-4 ${
                        missingRequiredFieldSet.has("manualAngle")
                          ? "border-rose-200 bg-rose-50/70"
                          : manualAngleExecuted
                            ? "border-emerald-200 bg-emerald-50/70"
                            : "border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-cyan-50/35"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">姿态纠偏建议</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            抓拍结果显示该支架存在角度偏差，已影响发电效率。请先执行一次姿态纠偏，再提交处理结果。
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                            manualAngleExecuted
                              ? "border-emerald-200 bg-white text-emerald-700"
                              : missingRequiredFieldSet.has("manualAngle")
                                ? "border-rose-200 bg-white text-rose-700"
                                : "border-sky-200 bg-white text-sky-700"
                          }`}
                        >
                          {manualAngleExecuted ? "已执行" : "待执行"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,180px)_repeat(2,minmax(0,1fr))]">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-slate-600">
                            调整角度
                          </span>
                          <input
                            value={manualAngleInput}
                            onChange={(event) => setManualAngleInput(event.target.value)}
                            inputMode="numeric"
                            placeholder="默认 10°"
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleManualAngleAction("west")}
                          disabled={manualAngleActionDisabled}
                          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                            manualAngleActionDisabled
                              ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                              : "border border-sky-200 bg-sky-600 text-white shadow-[0_10px_22px_rgba(2,132,199,0.26)] hover:bg-sky-700"
                          }`}
                        >
                          {manualAnglePending ? "计算中..." : "手动向西"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleManualAngleAction("east")}
                          disabled={manualAngleActionDisabled}
                          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                            manualAngleActionDisabled
                              ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                              : "border border-cyan-200 bg-white text-cyan-700 shadow-[0_10px_22px_rgba(14,116,144,0.14)] hover:bg-cyan-50"
                          }`}
                        >
                          {manualAnglePending ? "计算中..." : "手动向东"}
                        </button>
                      </div>

                      <p
                        className={`mt-3 text-[11px] leading-5 ${
                          manualAngleExecuted
                            ? "text-emerald-700"
                            : missingRequiredFieldSet.has("manualAngle")
                              ? "text-rose-600"
                              : "text-slate-500"
                        }`}
                      >
                        {manualAngleExecuted
                          ? manualAngleFeedback?.message
                          : missingRequiredFieldSet.has("manualAngle")
                            ? "提交前请至少执行一次手动向西或向东指令，系统才允许归档当前支架工单。"
                            : "输入为空时默认按 10° 执行。仅支持 0 到 90 之间的整数。"}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-slate-600">
                        故障组件
                      </span>
                      <select
                        value={formValues.faultComponent}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            faultComponent: event.target.value,
                          }))
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                      >
                        <option value="">等待抓拍自动填充</option>
                        {faultComponentOptions
                          .filter((option) => option)
                          .map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-slate-600">
                        故障模式
                      </span>
                      <select
                        value={formValues.faultMode}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            faultMode: event.target.value,
                          }))
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                      >
                        <option value="">等待抓拍自动填充</option>
                        {faultModeOptions
                          .filter((option) => option)
                          .map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <label className="mt-3 block space-y-1">
                    <RequiredLabel>诊断结果</RequiredLabel>
                    <textarea
                      required
                      aria-invalid={missingRequiredFieldSet.has("diagnosis")}
                      rows={4}
                      value={formValues.diagnosis}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          diagnosis: event.target.value,
                        }))
                      }
                      className={`w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500 ${
                        missingRequiredFieldSet.has("diagnosis")
                          ? "border-rose-300 bg-rose-50/40"
                          : "border-slate-300"
                      }`}
                      placeholder="详细说明判定根因与处理建议..."
                    />
                  </label>
                </>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-lg font-semibold text-slate-800">维修操作</p>
              {isHistoryDrawer ? (
                <>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-600">执行操作</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {activeDrawerFormValues.repairAction || "--"}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ReadonlyField
                      label="更换/使用的部件"
                      value={activeDrawerFormValues.partName}
                      tone="emphasis"
                    />
                    <ReadonlyField
                      label="归档来源"
                      value="机器人巡检历史工单"
                    />
                  </div>
                </>
              ) : (
                <>
                  <label className="mt-3 block space-y-1">
                    <RequiredLabel>执行操作</RequiredLabel>
                    <textarea
                      required
                      aria-invalid={missingRequiredFieldSet.has("repairAction")}
                      rows={3}
                      value={formValues.repairAction}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          repairAction: event.target.value,
                        }))
                      }
                      className={`w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500 ${
                        missingRequiredFieldSet.has("repairAction")
                          ? "border-rose-300 bg-rose-50/40"
                          : "border-slate-300"
                      }`}
                      placeholder="描述已完成/计划执行的维修步骤..."
                    />
                  </label>
                  <div className="mt-3">
                    <span className="text-xs font-semibold text-slate-600">
                      更换/使用的部件
                    </span>
                    <div className="mt-1 flex gap-2">
                      <input
                        value={formValues.partName}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            partName: event.target.value,
                          }))
                        }
                        className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                        placeholder="搜索库存或输入部件编号..."
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        添加部件
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-800">
                  证据与照片
                  {!isHistoryDrawer ? (
                    <span className="ml-1 text-sm text-rose-500">*</span>
                  ) : null}
                </p>
                <span className="text-xs font-semibold text-sky-700">
                  {activeDrawerEvidence.length > 0
                    ? `${isHistoryDrawer ? "已归档" : "已导入"} ${activeDrawerEvidence.length} 张机器人抓拍`
                    : isHistoryDrawer
                      ? "当前历史工单未归档机器人抓拍"
                      : "等待机器人抓拍导入"}
                </span>
              </div>
              {activeDrawerEvidence.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeDrawerEvidence.map((capture) => (
                    <article
                      key={capture.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-slate-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={capture.imageSrc}
                          alt={capture.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-1 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-800">{capture.title}</p>
                        <p className="text-xs text-slate-500">{capture.note}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{capture.time}</span>
                          <span>{capture.size}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div
                  className={`mt-3 flex h-[120px] items-center justify-center rounded-lg border border-dashed text-sm ${
                    !isHistoryDrawer && missingRequiredFieldSet.has("evidence")
                      ? "border-rose-300 bg-rose-50/50 text-rose-600"
                      : "border-slate-300 bg-slate-50 text-slate-500"
                  }`}
                >
                  {isHistoryDrawer
                    ? "该历史工单暂无归档图片。"
                    : "点击上方“抓拍”后，机器人回传的证据照片会自动填充到这里。"}
                </div>
              )}
            </section>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            {isHistoryDrawer ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  关闭
                </button>
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  保存草稿
                </button>
                <button
                  type="button"
                  onClick={handleSubmitWorkOrder}
                  disabled={!currentOrderPending || submitPending}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    currentOrderPending && !submitPending
                      ? "bg-sky-600 text-white shadow-[0_8px_16px_rgba(3,105,161,0.25)] transition-transform duration-200 hover:bg-sky-700 active:scale-[0.98]"
                      : submitPending
                        ? "cursor-wait bg-sky-500 text-white shadow-[0_8px_16px_rgba(3,105,161,0.18)]"
                      : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                  }`}
                >
                  {submitPending ? "处理中..." : "提交处理结果"}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/42 px-4 transition-opacity duration-200 ${
          submitPending ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="w-full max-w-sm rounded-2xl border border-sky-100/80 bg-white/96 p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.24)] backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-50">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sky-200 border-t-sky-600" />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-800">工单处理中</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            正在归档机器人抓拍、诊断结果和维修记录，请稍候...
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-full origin-left animate-pulse rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-cyan-400" />
          </div>
        </div>
      </div>

      {submitDialogState.open ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/48 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${
                  submitDialogState.tone === "error"
                    ? "bg-rose-100 text-rose-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                !
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-800">
                  {submitDialogState.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {submitDialogState.message}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {submitDialogState.tone === "error"
                    ? "请检查机器人服务状态，确认收尾指令可达后再重新提交。"
                    : "请补全必填信息，确认机器人抓拍照片已回传后，再重新提交。"}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closeSubmitDialog}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
