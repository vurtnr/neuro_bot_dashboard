"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  type ThreeElements,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  Instance,
  Instances,
  Lightformer,
  OrbitControls,
  Sky,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  AdditiveBlending,
  Box3,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  PCFSoftShadowMap,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
  type Group,
  type Material,
  type Mesh,
} from "three";
import type { GLTF } from "three-stdlib";
import {
  EffectComposer,
  RenderPass,
  UnrealBloomPass,
} from "three-stdlib";
import { generateMinuteLevelData } from "@/utils";

const MODEL2_MATRIX = {
  rows: 3,
  cols: 5,
};

const CLUSTER_COUNT = 2;
const MODEL2_HORIZONTAL_GROUP_COUNT = 3;
const MODEL1_TARGET_COUNT = 10;
const MODEL1_SCALE = 3;
const MODEL2_SCALE = 0.25;
const MODEL2_INNER_SPACING_FACTOR = 1.08;
const MATRIX_GROUP_SPACING_FACTOR = 1.05;
const CLUSTER_SPACING_FACTOR = 1.25;
const MODEL1_MATRIX_SEPARATION_FACTOR = 1.15;
const ENERGY_CURVE_ELEVATION = 0.9;
const ENERGY_CURVE_TENSION = 0.16;
const ENERGY_FLOW_RADIUS_MIN = 0.035;
const ENERGY_FLOW_RADIUS_MAX = 0.11;
const ENERGY_FLOW_SPEED_MIN = 0.35;
const ENERGY_FLOW_SPEED_MAX = 1.45;
const ENERGY_FLOW_INTENSITY_MIN = 0.5;
const ENERGY_FLOW_INTENSITY_MAX = 1.2;

type EnergyFlowScenario = {
  id: string;
  name: string;
  description: string;
  pvPowerMw: number;
  storagePowerMw: number;
  loadPowerMw: number;
  gridPowerMw: number;
  hasWarning: boolean;
};

const ENERGY_FLOW_TEST_SCENARIOS: EnergyFlowScenario[] = [
  {
    id: "live",
    name: "实时数据",
    description: "使用场站实时功率",
    pvPowerMw: 0,
    storagePowerMw: 0,
    loadPowerMw: 0,
    gridPowerMw: 0,
    hasWarning: false,
  },
  {
    id: "peak-generation",
    name: "正午高发",
    description: "光伏高发、并网外送",
    pvPowerMw: 17.4,
    storagePowerMw: 2.3,
    loadPowerMw: 9.8,
    gridPowerMw: 9.9,
    hasWarning: false,
  },
  {
    id: "cloudy-charge",
    name: "多云充电",
    description: "中等发电、储能充电",
    pvPowerMw: 8.2,
    storagePowerMw: 1.6,
    loadPowerMw: 7.4,
    gridPowerMw: 2.4,
    hasWarning: false,
  },
  {
    id: "evening-discharge",
    name: "傍晚放电",
    description: "低发电、储能放电支撑",
    pvPowerMw: 2.6,
    storagePowerMw: -4.4,
    loadPowerMw: 6.9,
    gridPowerMw: -0.1,
    hasWarning: false,
  },
  {
    id: "warning-curtailment",
    name: "告警限发",
    description: "设备告警、功率受限",
    pvPowerMw: 5.3,
    storagePowerMw: -1.9,
    loadPowerMw: 6.8,
    gridPowerMw: -3.4,
    hasWarning: true,
  },
  {
    id: "night-grid-support",
    name: "夜间保供",
    description: "光伏近零、储能主供",
    pvPowerMw: 0.35,
    storagePowerMw: -5.8,
    loadPowerMw: 5.1,
    gridPowerMw: -0.55,
    hasWarning: false,
  },
];

const SCENE_PRESETS = {
  midday: {
    name: "白天航拍",
    background: "#e8f4ff",
    fogNear: 45,
    fogFar: 180,
    sunPosition: [140, 55, 80] as [number, number, number],
    sky: { turbidity: 2.2, rayleigh: 2.4 },
    ambientIntensity: 0.95,
    directionalIntensity: 2.8,
    directionalColor: "#fff7e6",
    directionalPosition: [20, 30, 16] as [number, number, number],
    shadow: {
      mapSize: 2048,
      cameraNear: 1,
      cameraFar: 180,
      cameraBounds: 65,
      bias: -0.00015,
      normalBias: 0.015,
    },
    hemisphereSky: "#dff1ff",
    hemisphereGround: "#73808f",
    hemisphereIntensity: 0.82,
    groundColor: "#dbe3ec",
    contactShadow: { opacity: 0.55, scale: 90, blur: 2.8, far: 45 },
  },
  sunset: {
    name: "傍晚暖光",
    background: "#ffe9d7",
    fogNear: 30,
    fogFar: 120,
    sunPosition: [72, 14, 45] as [number, number, number],
    sky: { turbidity: 5.2, rayleigh: 1.5 },
    ambientIntensity: 0.45,
    directionalIntensity: 2.35,
    directionalColor: "#ffb56e",
    directionalPosition: [12, 18, 14] as [number, number, number],
    shadow: {
      mapSize: 1024,
      cameraNear: 1,
      cameraFar: 140,
      cameraBounds: 55,
      bias: -0.00014,
      normalBias: 0.014,
    },
    hemisphereSky: "#ffd7b4",
    hemisphereGround: "#6f6561",
    hemisphereIntensity: 0.65,
    groundColor: "#d6d0ca",
    contactShadow: { opacity: 0.72, scale: 100, blur: 2.2, far: 55 },
  },
};

type ScenePresetKey = keyof typeof SCENE_PRESETS;
type ScenePreset = (typeof SCENE_PRESETS)[ScenePresetKey];

function SceneEnvironment({ preset }: { preset: ScenePreset }) {
  const isDay = preset.name === "白天航拍";

  return (
    <Environment resolution={128}>
      <Lightformer
        form="rect"
        intensity={isDay ? 1.8 : 2.4}
        color={preset.directionalColor}
        position={[0, 12, -18]}
        rotation-x={Math.PI / 2}
        scale={[42, 20, 1]}
      />
      <Lightformer
        form="rect"
        intensity={isDay ? 0.85 : 1.2}
        color={preset.hemisphereSky}
        position={[-16, 7, 14]}
        rotation-y={Math.PI / 3}
        scale={[18, 14, 1]}
      />
      <Lightformer
        form="rect"
        intensity={isDay ? 0.45 : 0.75}
        color={preset.hemisphereGround}
        position={[16, 4, 10]}
        rotation-y={-Math.PI / 4}
        scale={[12, 10, 1]}
      />
    </Environment>
  );
}

export interface SiteDashboardData {
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

type Model1DeviceInfo = {
  capacityKWh: number;
  temperature: number;
  current: number;
  voltage: number;
};

type Model2DeviceInfo = {
  actualAngle: number;
  targetAngle: number;
  motorCurrent: number;
  motorVoltage: number;
  workMode: "自动模式";
  alarms: string[];
};

type SelectedDevice =
  | { type: "model1"; index: number; info: Model1DeviceInfo }
  | { type: "model2"; index: number; info: Model2DeviceInfo };

const MODEL2_INSTANCE_COUNT =
  CLUSTER_COUNT *
  MODEL2_HORIZONTAL_GROUP_COUNT *
  MODEL2_MATRIX.rows *
  MODEL2_MATRIX.cols;

function buildModel1DeviceInfos(): Model1DeviceInfo[] {
  return Array.from({ length: MODEL1_TARGET_COUNT }, (_, idx) => ({
    capacityKWh: Number((220 + idx * 7.5).toFixed(1)),
    temperature: Number((28 + (idx * 3.1) % 26).toFixed(1)),
    current: Number((62 + (idx * 5.8) % 74).toFixed(1)),
    voltage: Number((642 + (idx * 9.4) % 126).toFixed(1)),
  }));
}

function deriveModel1Snapshot(info: Model1DeviceInfo, index: number) {
  const soc = Math.max(36, Math.min(97, Math.round((info.capacityKWh / 320) * 100)));
  const workingMode = index % 3 === 0 ? "均衡待机" : index % 2 === 0 ? "充电中" : "放电中";
  const signedPower =
    ((info.voltage * info.current) / 1000) * (workingMode === "放电中" ? -1 : 1);
  const powerKw = Number(signedPower.toFixed(2));
  const voltageDeviation = Math.abs(info.voltage - 700);
  const voltageStability = Math.max(
    56,
    Math.min(99, Math.round(100 - voltageDeviation * 0.28)),
  );
  const thermalHeadroom = Math.max(8, Math.min(100, Math.round(100 - info.temperature * 1.26)));
  const currentLoad = Math.max(12, Math.min(98, Math.round((info.current / 140) * 100)));
  const healthIndex = Math.max(
    68,
    Math.min(
      99,
      Math.round(
        voltageStability * 0.42 + thermalHeadroom * 0.33 + (100 - currentLoad) * 0.25,
      ),
    ),
  );
  const thermalLevel =
    info.temperature >= 48 ? "hot" : info.temperature >= 38 ? "warning" : "normal";

  return {
    soc,
    workingMode,
    powerKw,
    voltageStability,
    thermalHeadroom,
    currentLoad,
    healthIndex,
    thermalLevel,
    cycleCount: 580 + index * 17,
  };
}

function buildModel2DeviceInfos(): Model2DeviceInfo[] {
  const alarmPool = [
    "跟踪偏差超限",
    "电机过流",
    "通信延迟告警",
    "角度编码器抖动",
    "限位开关异常",
    "阵风保护动作",
  ];

  return Array.from({ length: MODEL2_INSTANCE_COUNT }, (_, idx) => {
    const actualAngle = Number((12 + (idx % 15) * 2.4).toFixed(1));
    const targetAngle = Number((actualAngle + ((idx % 4) - 1.5) * 1.6).toFixed(1));
    const motorCurrent = Number((1.8 + (idx * 0.23) % 2.7).toFixed(2));
    const motorVoltage = Number((24.2 + (idx * 0.37) % 6.3).toFixed(1));
    const alarmCount = idx % 7 === 0 ? 2 : idx % 4 === 0 ? 1 : 0;
    const alarms = Array.from({ length: alarmCount }, (_, alarmIdx) => {
      return alarmPool[(idx + alarmIdx * 2) % alarmPool.length];
    });

    return {
      actualAngle,
      targetAngle,
      motorCurrent,
      motorVoltage,
      workMode: "自动模式",
      alarms,
    };
  });
}

function deriveModel2Snapshot(info: Model2DeviceInfo) {
  const trackingError = Number(Math.abs(info.actualAngle - info.targetAngle).toFixed(1));
  const alignmentScore = Math.max(42, Math.min(99, Math.round(100 - trackingError * 9.4)));
  const motorLoad = Math.max(
    14,
    Math.min(98, Math.round((info.motorCurrent / 4.5) * 100)),
  );
  const voltageHealth = Math.max(
    36,
    Math.min(98, Math.round(100 - Math.abs(info.motorVoltage - 27.5) * 10.5)),
  );
  const alarmPenalty = Math.min(26, info.alarms.length * 8);
  const controlStability = Math.max(
    38,
    Math.min(
      98,
      Math.round(alignmentScore * 0.52 + voltageHealth * 0.33 + (100 - motorLoad) * 0.15) -
        alarmPenalty,
    ),
  );
  const statusLevel =
    info.alarms.length >= 2
      ? "critical"
      : info.alarms.length === 1 || trackingError > 2
        ? "warning"
        : "normal";
  const statusLabel =
    statusLevel === "critical"
      ? "告警处理"
      : statusLevel === "warning"
        ? "偏差补偿"
        : "稳定跟踪";

  return {
    trackingError,
    alignmentScore,
    motorLoad,
    voltageHealth,
    controlStability,
    statusLevel,
    statusLabel,
  };
}

type Model1GLTFResult = GLTF & {
  nodes: {
    node_0: Mesh;
  };
  materials: {
    "Material.001": Material;
  };
};

type Model2GLTFResult = GLTF & {
  nodes: {
    Panel_solar__2__concrete_0: Mesh;
    Panel_solar__2__steel_0: Mesh;
    Panel_solar__2__paint_0: Mesh;
    Panel_solar__2__black_plastic_0: Mesh;
    Panel_solar__2__plastic_red_0: Mesh;
    Panel_solar__2__gum_0: Mesh;
    Panel_solar__2___05___Default_0: Mesh;
    Panel_solar__2__Material__3971_Slot__8_0: Mesh;
    Panel_solar__2__al_0: Mesh;
  };
  materials: {
    concrete: Material;
    steel: Material;
    paint: Material;
    black_plastic: Material;
    plastic_red: Material;
    material: Material;
    "05___Default": Material;
    Material__3971_Slot__8: Material;
    material_8: Material;
  };
};

const MODEL2_MESHES: Array<{
  node: keyof Model2GLTFResult["nodes"];
  material: keyof Model2GLTFResult["materials"];
}> = [
  { node: "Panel_solar__2__concrete_0", material: "concrete" },
  { node: "Panel_solar__2__steel_0", material: "steel" },
  { node: "Panel_solar__2__paint_0", material: "paint" },
  { node: "Panel_solar__2__black_plastic_0", material: "black_plastic" },
  { node: "Panel_solar__2__plastic_red_0", material: "plastic_red" },
  { node: "Panel_solar__2__gum_0", material: "material" },
  { node: "Panel_solar__2___05___Default_0", material: "05___Default" },
  {
    node: "Panel_solar__2__Material__3971_Slot__8_0",
    material: "Material__3971_Slot__8",
  },
  { node: "Panel_solar__2__al_0", material: "material_8" },
];

function createTrendOptions({
  title,
  unit,
  color,
  data,
  categories,
  isDay,
  height = 190,
}: {
  title: string;
  unit: string;
  color: string;
  data: number[];
  categories: string[];
  isDay: boolean;
  height?: number;
}): Highcharts.Options {
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
      lineColor: isDay ? "rgba(100,116,139,0.3)" : "rgba(234,88,12,0.22)",
      labels: {
        style: { color: isDay ? "#475569" : "#9a3412", fontSize: "10px" },
      },
    },
    yAxis: {
      title: { text: undefined },
      gridLineDashStyle: "ShortDash",
      gridLineColor: isDay ? "rgba(100,116,139,0.2)" : "rgba(217,119,6,0.2)",
      labels: {
        style: { color: isDay ? "#64748b" : "#9a3412", fontSize: "10px" },
      },
    },
    tooltip: {
      shared: true,
      backgroundColor: isDay
        ? "rgba(255,255,255,0.96)"
        : "rgba(255,247,237,0.96)",
      borderColor: isDay ? "rgba(14,116,144,0.35)" : "rgba(234,88,12,0.35)",
      valueSuffix: ` ${unit}`,
    },
    plotOptions: {
      areaspline: {
        lineWidth: 2,
        color,
        marker: { enabled: false },
        fillOpacity: 0.2,
      },
    },
    series: [{ type: "areaspline", name: title, data, color }],
  };
}

type EnergyFlowMode = "charge" | "discharge";

type EnergyFlowInput = {
  pvPowerMw: number;
  storagePowerMw: number;
  loadPowerMw: number;
  gridPowerMw: number;
  hasWarning: boolean;
};

type EnergyFlowDescriptor = {
  id: string;
  curve: CatmullRomCurve3;
  width: number;
  speed: number;
  intensity: number;
  colorStart: string;
  colorEnd: string;
  pulseColor: string;
  pulseScale: number;
};

const FLOW_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOW_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform vec3 uColorStart;
  uniform vec3 uColorEnd;

  void main() {
    float track = fract(vUv.x * 7.0 - uTime * uSpeed);
    float head = smoothstep(0.0, 0.16, track) * (1.0 - smoothstep(0.16, 0.4, track));
    float pulse2 = smoothstep(0.5, 0.62, track) * (1.0 - smoothstep(0.62, 0.83, track));
    float lane = smoothstep(0.5, 0.02, abs(vUv.y - 0.5));
    float sideGlow = smoothstep(0.5, 0.24, abs(vUv.y - 0.5));

    vec3 gradient = mix(uColorStart, uColorEnd, track);
    float bright = (0.35 + head * 1.15 + pulse2 * 0.8 + lane * 0.25 + sideGlow * 0.12) * uIntensity;
    float alpha = clamp((0.1 + head * 0.34 + pulse2 * 0.25 + lane * 0.08) * uIntensity, 0.04, 0.72);

    gl_FragColor = vec4(gradient * bright, alpha);
  }
`;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mixNumber(start: number, end: number, factor: number) {
  return start + (end - start) * factor;
}

function computeCurveControls({
  from,
  to,
  laneOffset,
  rowOffset,
}: {
  from: Vector3;
  to: Vector3;
  laneOffset: number;
  rowOffset: number;
}) {
  const mid = from.clone().lerp(to, 0.5);
  const distance = from.distanceTo(to);
  const lift = ENERGY_CURVE_ELEVATION + distance * 0.05;
  const dir = to.clone().sub(from);
  const lateral = new Vector3(-dir.z, 0, dir.x).normalize();
  const laneShift = distance * 0.08 * laneOffset;
  const rowLift = rowOffset * 0.12;

  const c1 = from.clone().lerp(mid, 0.45);
  c1.y += lift + rowLift;
  c1.addScaledVector(lateral, laneShift);
  const c2 = mid.clone().lerp(to, 0.55);
  c2.y += lift * 0.85 + rowLift * 0.72;
  c2.addScaledVector(lateral, laneShift * 0.82);

  return [from, c1, c2, to];
}

function getFlowPalette(isDay: boolean, hasWarning: boolean) {
  if (hasWarning) {
    return {
      start: "#f97316",
      end: "#ef4444",
      pulse: "#fb7185",
    };
  }

  if (isDay) {
    return {
      start: "#67e8f9",
      end: "#3b82f6",
      pulse: "#38bdf8",
    };
  }

  return {
    start: "#fdba74",
    end: "#f97316",
    pulse: "#fb923c",
  };
}

function buildEnergyFlowDescriptors({
  matrixAnchors,
  model1Anchors,
  flowInput,
  isDay,
  matrixGroupXCount,
  matrixGroupZCount,
}: {
  matrixAnchors: Vector3[];
  model1Anchors: Vector3[];
  flowInput: EnergyFlowInput;
  isDay: boolean;
  matrixGroupXCount: number;
  matrixGroupZCount: number;
}): EnergyFlowDescriptor[] {
  if (!matrixAnchors.length || !model1Anchors.length) {
    return [];
  }

  const mode: EnergyFlowMode =
    flowInput.storagePowerMw >= 0 ? "charge" : "discharge";
  const drivingPower =
    mode === "charge"
      ? Math.max(0, flowInput.pvPowerMw)
      : Math.max(0.35, Math.abs(flowInput.storagePowerMw));
  const normalizedPower = clampNumber(drivingPower / 18, 0.06, 1);
  const palette = getFlowPalette(isDay, flowInput.hasWarning);
  const zMin = Math.min(...model1Anchors.map((point) => point.z));
  const zMax = Math.max(...model1Anchors.map((point) => point.z));
  const zSpan = Math.max(0.001, zMax - zMin);

  return matrixAnchors.map((matrixPoint, idx) => {
    const colIndex = idx % matrixGroupXCount;
    const rowIndex = Math.floor(idx / matrixGroupXCount);
    const laneOffset = colIndex - (matrixGroupXCount - 1) * 0.5;
    const rowOffset =
      rowIndex - Math.max(0, (matrixGroupZCount - 1) * 0.5);
    const ratio = clampNumber((matrixPoint.z - zMin) / zSpan, 0, 1);
    const baseModel1Idx = Math.round(ratio * (model1Anchors.length - 1));
    const laneSpread = Math.max(
      1,
      Math.round((model1Anchors.length - 1) / (matrixGroupXCount * 2)),
    );
    const model1Idx = clampNumber(
      baseModel1Idx + Math.round(laneOffset * laneSpread),
      0,
      model1Anchors.length - 1,
    );
    const model1Point = model1Anchors[model1Idx];
    const from = mode === "charge" ? matrixPoint.clone() : model1Point.clone();
    const to = mode === "charge" ? model1Point.clone() : matrixPoint.clone();
    const controls = computeCurveControls({
      from,
      to,
      laneOffset,
      rowOffset,
    });
    const curve = new CatmullRomCurve3(
      controls,
      false,
      "catmullrom",
      ENERGY_CURVE_TENSION,
    );
    const localVariance = 0.9 + Math.sin(idx * 1.57) * 0.12;
    const weight = clampNumber(normalizedPower * localVariance, 0.08, 1);

    return {
      id: `energy-${idx}`,
      curve,
      width: mixNumber(ENERGY_FLOW_RADIUS_MIN, ENERGY_FLOW_RADIUS_MAX, weight),
      speed: mixNumber(ENERGY_FLOW_SPEED_MIN, ENERGY_FLOW_SPEED_MAX, weight),
      intensity: mixNumber(
        ENERGY_FLOW_INTENSITY_MIN,
        ENERGY_FLOW_INTENSITY_MAX,
        weight,
      ),
      colorStart: palette.start,
      colorEnd: palette.end,
      pulseColor: palette.pulse,
      pulseScale: mixNumber(0.85, 1.25, weight),
    };
  });
}

function EnergyFlowTube({
  descriptor,
}: {
  descriptor: EnergyFlowDescriptor;
}) {
  const materialRef = useRef<ShaderMaterial | null>(null);
  const coreGeometry = useMemo(
    () => new TubeGeometry(descriptor.curve, 110, descriptor.width, 16, false),
    [descriptor.curve, descriptor.width],
  );
  const haloGeometry = useMemo(
    () =>
      new TubeGeometry(
        descriptor.curve,
        90,
        descriptor.width * 1.8,
        14,
        false,
      ),
    [descriptor.curve, descriptor.width],
  );
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: descriptor.speed },
      uIntensity: { value: descriptor.intensity },
      uColorStart: { value: new Color(descriptor.colorStart) },
      uColorEnd: { value: new Color(descriptor.colorEnd) },
    }),
    [
      descriptor.colorEnd,
      descriptor.colorStart,
      descriptor.intensity,
      descriptor.speed,
    ],
  );

  useEffect(() => {
    return () => {
      coreGeometry.dispose();
      haloGeometry.dispose();
    };
  }, [coreGeometry, haloGeometry]);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <group>
      <mesh geometry={haloGeometry} renderOrder={5} frustumCulled>
        <meshBasicMaterial
          color={descriptor.colorEnd}
          transparent
          opacity={0.14}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={coreGeometry} renderOrder={6} frustumCulled>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={FLOW_VERTEX_SHADER}
          fragmentShader={FLOW_FRAGMENT_SHADER}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function EnergyAnchorNodes({
  anchors,
  coreColor,
  ringColor,
}: {
  anchors: Vector3[];
  coreColor: string;
  ringColor: string;
}) {
  const pulseRefs = useRef<Array<Group | null>>([]);

  useFrame((state) => {
    pulseRefs.current.forEach((node, idx) => {
      if (!node) {
        return;
      }

      const wave = 0.85 + Math.sin(state.clock.elapsedTime * 2.2 + idx * 0.7) * 0.18;
      node.scale.setScalar(wave);
    });
  });

  return (
    <group>
      {anchors.map((anchor, idx) => (
        <group
          key={`energy-anchor-${idx}`}
          position={[anchor.x, anchor.y, anchor.z]}
          ref={(value) => {
            pulseRefs.current[idx] = value;
          }}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.16, 0.03, 10, 32]} />
            <meshBasicMaterial
              color={ringColor}
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.06, 14, 14]} />
            <meshBasicMaterial
              color={coreColor}
              transparent
              opacity={0.95}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.028, 0.04, 0.22, 12]} />
            <meshBasicMaterial
              color={ringColor}
              transparent
              opacity={0.35}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MatrixEnergyFenceWalls({
  centers,
  width,
  depth,
  height,
  baseY,
  wallColor,
  edgeColor,
}: {
  centers: Vector3[];
  width: number;
  depth: number;
  height: number;
  baseY: number;
  wallColor: string;
  edgeColor: string;
}) {
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const halfH = height * 0.5;
  const wallThickness = 0.026;
  const frameThickness = 0.045;

  return (
    <group>
      {centers.map((center, idx) => (
        <group
          key={`matrix-fence-${idx}`}
          position={[center.x, baseY + halfH, center.z]}
        >
          <mesh position={[0, 0, -halfD]} renderOrder={4}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
              color={wallColor}
              transparent
              opacity={0.14}
              side={DoubleSide}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, halfD]} renderOrder={4}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
              color={wallColor}
              transparent
              opacity={0.14}
              side={DoubleSide}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[-halfW, 0, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={4}>
            <planeGeometry args={[depth, height]} />
            <meshBasicMaterial
              color={wallColor}
              transparent
              opacity={0.14}
              side={DoubleSide}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[halfW, 0, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={4}>
            <planeGeometry args={[depth, height]} />
            <meshBasicMaterial
              color={wallColor}
              transparent
              opacity={0.14}
              side={DoubleSide}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>

          <mesh position={[0, halfH, -halfD]} renderOrder={5}>
            <boxGeometry args={[width, wallThickness, frameThickness]} />
            <meshBasicMaterial
              color={edgeColor}
              transparent
              opacity={0.74}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, halfH, halfD]} renderOrder={5}>
            <boxGeometry args={[width, wallThickness, frameThickness]} />
            <meshBasicMaterial
              color={edgeColor}
              transparent
              opacity={0.74}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[-halfW, halfH, 0]} renderOrder={5}>
            <boxGeometry args={[frameThickness, wallThickness, depth]} />
            <meshBasicMaterial
              color={edgeColor}
              transparent
              opacity={0.74}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[halfW, halfH, 0]} renderOrder={5}>
            <boxGeometry args={[frameThickness, wallThickness, depth]} />
            <meshBasicMaterial
              color={edgeColor}
              transparent
              opacity={0.74}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>

          {[
            [-halfW, 0, -halfD],
            [halfW, 0, -halfD],
            [-halfW, 0, halfD],
            [halfW, 0, halfD],
          ].map((corner, cornerIdx) => (
            <mesh
              key={`corner-${cornerIdx}`}
              position={[corner[0], 0, corner[2]]}
              renderOrder={5}
            >
              <boxGeometry args={[frameThickness, height, frameThickness]} />
              <meshBasicMaterial
                color={edgeColor}
                transparent
                opacity={0.5}
                blending={AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function EnergyFlowPulse({
  descriptor,
  phaseOffset,
  isDay,
}: {
  descriptor: EnergyFlowDescriptor;
  phaseOffset: number;
  isDay: boolean;
}) {
  const pulseRef = useRef<Group | null>(null);
  const pointScratch = useMemo(() => new Vector3(), []);

  useFrame((state) => {
    if (!pulseRef.current) {
      return;
    }

    const speedFactor = isDay ? 0.56 : 0.64;
    const t =
      (phaseOffset + state.clock.elapsedTime * descriptor.speed * speedFactor) %
      1;
    descriptor.curve.getPointAt(t, pointScratch);
    pulseRef.current.position.set(pointScratch.x, pointScratch.y + 0.03, pointScratch.z);
    const pulseWaveBase = isDay ? 1.04 : 1.12;
    const pulseWaveAmp = isDay ? 0.2 : 0.28;
    const pulseWave =
      pulseWaveBase +
      Math.sin(state.clock.elapsedTime * (isDay ? 7.8 : 9.2) + phaseOffset * 12) *
        pulseWaveAmp;
    pulseRef.current.scale.setScalar(pulseWave * descriptor.pulseScale);
  });

  const coreRadius = isDay ? 0.095 : 0.115;
  const haloRadius = isDay ? 0.2 : 0.24;
  const coreColor = isDay ? "#ecfeff" : "#fff7e6";
  const haloColor = isDay ? descriptor.colorEnd : descriptor.pulseColor;

  return (
    <group ref={pulseRef}>
      <mesh renderOrder={8}>
        <sphereGeometry args={[coreRadius, 12, 12]} />
        <meshBasicMaterial
          color={coreColor}
          toneMapped={false}
          transparent
          opacity={isDay ? 0.98 : 1}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <mesh renderOrder={7}>
        <sphereGeometry args={[haloRadius, 12, 12]} />
        <meshBasicMaterial
          color={haloColor}
          toneMapped={false}
          transparent
          opacity={isDay ? 0.34 : 0.46}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={9}>
        <torusGeometry args={[haloRadius * 0.68, haloRadius * 0.08, 10, 28]} />
        <meshBasicMaterial
          color={descriptor.pulseColor}
          toneMapped={false}
          transparent
          opacity={isDay ? 0.58 : 0.7}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}

function EnergyFlowLayer({
  descriptors,
  isDay,
}: {
  descriptors: EnergyFlowDescriptor[];
  isDay: boolean;
}) {
  return (
    <group>
      {descriptors.map((descriptor, idx) => (
        <group key={descriptor.id}>
          <EnergyFlowTube descriptor={descriptor} />
          <EnergyFlowPulse
            descriptor={descriptor}
            phaseOffset={idx * 0.133}
            isDay={isDay}
          />
          <EnergyFlowPulse
            descriptor={descriptor}
            phaseOffset={idx * 0.62}
            isDay={isDay}
          />
          <EnergyFlowPulse
            descriptor={descriptor}
            phaseOffset={idx * 0.62 + 0.33}
            isDay={isDay}
          />
        </group>
      ))}
    </group>
  );
}

function BloomPassController({
  threshold,
  strength,
  radius,
}: {
  threshold: number;
  strength: number;
  radius: number;
}) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new Vector2(size.width, size.height),
        strength,
        radius,
        threshold,
      ),
    );
    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [camera, gl, radius, scene, size.height, size.width, strength, threshold]);

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size.height, size.width]);

  useFrame((_, delta) => {
    composerRef.current?.render(delta);
  }, 1);

  return null;
}

function Loader() {
  return (
    <Html center>
      <div className="rounded-md border border-sky-300/70 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700">
        3D 场景加载中...
      </div>
    </Html>
  );
}

function Ground({ color }: { color: string }) {
  const { gl } = useThree();
  const map = useTexture("/land.png", (loadedMap) => {
    loadedMap.wrapS = RepeatWrapping;
    loadedMap.wrapT = RepeatWrapping;
    loadedMap.repeat.set(32, 32);
    loadedMap.colorSpace = SRGBColorSpace;
    loadedMap.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    loadedMap.needsUpdate = true;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.03, 0]}
      receiveShadow
    >
      <planeGeometry args={[240, 240]} />
      <meshStandardMaterial
        map={map}
        color={color}
        roughness={0.9}
        metalness={0.02}
      />
    </mesh>
  );
}

function BatteryPreviewModel() {
  const batteryRef = useRef<null | Group>(null);
  const batteryScene = (useGLTF("/battery.glb") as GLTF).scene;
  const { previewScene, previewScale, previewOffsetY } = useMemo(() => {
    const clone = batteryScene.clone();
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    clone.position.sub(center);
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
    const targetDimension = 2.15;
    const scale = targetDimension / maxDimension;

    return {
      previewScene: clone,
      previewScale: scale,
      previewOffsetY: -(size.y * scale) * 0.06,
    };
  }, [batteryScene]);

  useFrame((_, delta) => {
    if (batteryRef.current) {
      batteryRef.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <group ref={batteryRef} scale={previewScale} position={[0, previewOffsetY, 0]}>
      <primitive object={previewScene} />
    </group>
  );
}

function BatteryPreviewCanvas({ isDay }: { isDay: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.25]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.05, 5.8], fov: 39 }}
    >
      <color attach="background" args={[isDay ? "#eff6ff" : "#1b1a1f"]} />
      <ambientLight intensity={isDay ? 0.88 : 0.74} />
      <directionalLight
        position={[4, 8, 5]}
        intensity={isDay ? 1.32 : 1.08}
        color={isDay ? "#ffffff" : "#ffdcb5"}
      />
      <directionalLight
        position={[-3, 5, -4]}
        intensity={isDay ? 0.46 : 0.65}
        color={isDay ? "#bae6fd" : "#fb923c"}
      />
      <ContactShadows
        position={[0, -1.02, 0]}
        opacity={isDay ? 0.28 : 0.36}
        scale={3.3}
        blur={1.7}
        far={2.2}
      />
      <Suspense fallback={<Loader />}>
        <BatteryPreviewModel />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} />
    </Canvas>
  );
}

function Model1(props: ThreeElements["group"]) {
  const { nodes, materials } = useGLTF("/1.glb") as unknown as Model1GLTFResult;

  return (
    <group {...props} dispose={null}>
      <mesh
        geometry={nodes.node_0.geometry}
        material={materials["Material.001"]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

function Model2Instanced({
  positions,
  scale,
  onSelect,
}: {
  positions: [number, number, number][];
  scale: number;
  onSelect?: (index: number) => void;
}) {
  const { nodes, materials } = useGLTF("/2.glb") as unknown as Model2GLTFResult;
  const finalScale = scale * 1.66664;

  return (
    <group dispose={null}>
      {MODEL2_MESHES.map(({ node, material }) => (
        <Instances
          key={node}
          geometry={nodes[node].geometry}
          material={materials[material]}
          castShadow
          receiveShadow
          frustumCulled
        >
          {positions.map((position, idx) => (
            <Instance
              key={`${node}-${idx}`}
              position={position}
              rotation={[0, Math.PI / 2, 0]}
              scale={finalScale}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(idx);
              }}
            />
          ))}
        </Instances>
      ))}
    </group>
  );
}

function Scene({
  preset,
  flowInput,
  onSelectModel1,
  onSelectModel2,
}: {
  preset: ScenePreset;
  flowInput: EnergyFlowInput;
  onSelectModel1: (index: number) => void;
  onSelectModel2: (index: number) => void;
}) {
  const model1Ref = useRef<null | Group>(null);
  const model2SampleRef = useRef<null | Group>(null);
  const model2Scene = (useGLTF("/2.glb") as GLTF).scene;
  const [layout, setLayout] = useState({
    spacingX: 5,
    spacingZ: 5,
    matrixWidth: 10,
    matrixDepth: 6,
    model1FenceWidth: 3.5,
    model1FenceDepth: 26,
    model1SpacingZ: 2.4,
    matrixGroupSpacingX: 18,
    model1X: -12,
    clusterSpacingZ: 18,
    model1TopY: 1.4,
    model2TopY: 0.75,
  });
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);

  useFrame(() => {
    if (isLayoutLocked || !model1Ref.current || !model2SampleRef.current) {
      return;
    }

    const box1 = new Box3().setFromObject(model1Ref.current);
    const box2 = new Box3().setFromObject(model2SampleRef.current);

    if (box1.isEmpty() || box2.isEmpty()) {
      return;
    }

    const size1 = new Vector3();
    const size2 = new Vector3();
    box1.getSize(size1);
    box2.getSize(size2);

    const model1Span = Math.max(size1.x, size1.z);
    if (model1Span <= 0) {
      return;
    }

    const model2PlanarSpan = Math.max(size2.x, size2.z, 0.5);
    const spacingX = model2PlanarSpan * MODEL2_INNER_SPACING_FACTOR;
    const spacingZ = model2PlanarSpan * MODEL2_INNER_SPACING_FACTOR;
    const matrixWidth = (MODEL2_MATRIX.cols - 1) * spacingX + model2PlanarSpan;
    const matrixDepth = (MODEL2_MATRIX.rows - 1) * spacingZ + model2PlanarSpan;
    const matrixGroupSpacingX = matrixWidth * MATRIX_GROUP_SPACING_FACTOR;
    const totalMatrixHalfWidth =
      (MODEL2_HORIZONTAL_GROUP_COUNT - 1) * 0.5 * matrixGroupSpacingX +
      matrixWidth * 0.5;
    const model1HalfWidth = Math.max(size1.x, size1.z) * 0.5;
    const separation = model2PlanarSpan * MODEL1_MATRIX_SEPARATION_FACTOR;
    const model1X = -totalMatrixHalfWidth - model1HalfWidth - separation;
    const clusterSpacingZ = matrixDepth * CLUSTER_SPACING_FACTOR;
    // Keep Model1 instances separated by their own footprint to avoid overlap.
    const model1SpacingZ = Math.max(size1.z * 1.08, size1.x * 0.78, 2.2);
    const model1TopY = box1.max.y + Math.max(0.16, size1.y * 0.08);
    const model2TopY = box2.max.y + Math.max(0.1, size2.y * 0.16);
    const model1FenceWidth = Math.max(size1.x, 1.8) + 0.34;
    const model1RangeZ = Math.max(0, (MODEL1_TARGET_COUNT - 1) * model1SpacingZ);

    setLayout({
      spacingX,
      spacingZ,
      matrixWidth,
      matrixDepth,
      model1FenceWidth,
      model1FenceDepth:
        model1RangeZ + Math.max(size1.z, 1.2) + 0.46,
      model1SpacingZ,
      matrixGroupSpacingX,
      model1X,
      clusterSpacingZ,
      model1TopY,
      model2TopY,
    });

    setIsLayoutLocked(true);
  });

  const clusterZOffsets = Array.from(
    { length: CLUSTER_COUNT },
    (_, clusterIndex) =>
      (clusterIndex - (CLUSTER_COUNT - 1) / 2) * layout.clusterSpacingZ,
  );

  const matrixGroupXOffsets = Array.from(
    { length: MODEL2_HORIZONTAL_GROUP_COUNT },
    (_, groupIndex) =>
      (groupIndex - (MODEL2_HORIZONTAL_GROUP_COUNT - 1) / 2) *
      layout.matrixGroupSpacingX,
  );

  const model1ZOffsets = Array.from(
    { length: MODEL1_TARGET_COUNT },
    (_, idx) => {
      return (
        (idx - (MODEL1_TARGET_COUNT - 1) / 2) * layout.model1SpacingZ
      );
    },
  );
  const model1MinZ = model1ZOffsets[0] ?? 0;
  const model1MaxZ = model1ZOffsets[model1ZOffsets.length - 1] ?? 0;

  const model2InstancePositions = useMemo<[number, number, number][]>(() => {
    const positions: [number, number, number][] = [];

    for (const zOffset of clusterZOffsets) {
      for (const groupXOffset of matrixGroupXOffsets) {
        for (let row = 0; row < MODEL2_MATRIX.rows; row += 1) {
          for (let col = 0; col < MODEL2_MATRIX.cols; col += 1) {
            const x =
              groupXOffset +
              (col - (MODEL2_MATRIX.cols - 1) / 2) * layout.spacingX;
            const z =
              zOffset + (row - (MODEL2_MATRIX.rows - 1) / 2) * layout.spacingZ;
            positions.push([x, 0, z]);
          }
        }
      }
    }

    return positions;
  }, [clusterZOffsets, matrixGroupXOffsets, layout.spacingX, layout.spacingZ]);

  const model2MatrixAnchors = useMemo(
    () =>
      clusterZOffsets.flatMap((zOffset) =>
        matrixGroupXOffsets.map(
          (xOffset) => new Vector3(xOffset, layout.model2TopY, zOffset),
        ),
      ),
    [clusterZOffsets, layout.model2TopY, matrixGroupXOffsets],
  );

  const model1Anchors = useMemo(
    () =>
      model1ZOffsets.map(
        (zOffset) => new Vector3(layout.model1X, layout.model1TopY, zOffset),
      ),
    [layout.model1TopY, layout.model1X, model1ZOffsets],
  );
  const model1FenceCenters = useMemo(
    () => [new Vector3(layout.model1X, 0, (model1MinZ + model1MaxZ) * 0.5)],
    [layout.model1X, model1MaxZ, model1MinZ],
  );

  const energyDescriptors = useMemo(
    () =>
      buildEnergyFlowDescriptors({
        matrixAnchors: model2MatrixAnchors,
        model1Anchors,
        flowInput,
        isDay: preset.name === "白天航拍",
        matrixGroupXCount: MODEL2_HORIZONTAL_GROUP_COUNT,
        matrixGroupZCount: CLUSTER_COUNT,
      }),
    [flowInput, model1Anchors, model2MatrixAnchors, preset.name],
  );
  const flowPalette = useMemo(
    () => getFlowPalette(preset.name === "白天航拍", flowInput.hasWarning),
    [flowInput.hasWarning, preset.name],
  );

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={preset.sunPosition}
        inclination={0.5}
        azimuth={0.25}
        turbidity={preset.sky.turbidity}
        rayleigh={preset.sky.rayleigh}
      />

      <ambientLight intensity={preset.ambientIntensity} />
      <directionalLight
        color={preset.directionalColor}
        position={preset.directionalPosition}
        intensity={preset.directionalIntensity}
        castShadow
        shadow-mapSize-width={preset.shadow.mapSize}
        shadow-mapSize-height={preset.shadow.mapSize}
        shadow-camera-near={preset.shadow.cameraNear}
        shadow-camera-far={preset.shadow.cameraFar}
        shadow-camera-left={-preset.shadow.cameraBounds}
        shadow-camera-right={preset.shadow.cameraBounds}
        shadow-camera-top={preset.shadow.cameraBounds}
        shadow-camera-bottom={-preset.shadow.cameraBounds}
        shadow-bias={preset.shadow.bias}
        shadow-normalBias={preset.shadow.normalBias}
      />
      <hemisphereLight
        color={preset.hemisphereSky}
        groundColor={preset.hemisphereGround}
        intensity={preset.hemisphereIntensity}
      />
      <Ground color={preset.groundColor} />

      <Suspense fallback={<Loader />}>
        <group ref={model2SampleRef} visible={false} scale={MODEL2_SCALE}>
          <primitive object={model2Scene.clone()} />
        </group>

        {model1ZOffsets.map((zOffset, idx) => (
          <group
            key={`model1-${idx}`}
            ref={idx === 0 ? model1Ref : null}
            position={[layout.model1X, 0, zOffset]}
            scale={MODEL1_SCALE}
            onClick={(event) => {
              event.stopPropagation();
              onSelectModel1(idx);
            }}
          >
            <Model1 />
          </group>
        ))}
        <MatrixEnergyFenceWalls
          centers={model1FenceCenters}
          width={layout.model1FenceWidth}
          depth={layout.model1FenceDepth}
          height={Math.max(1.2, layout.model1TopY + 0.4)}
          baseY={0.04}
          wallColor={flowPalette.start}
          edgeColor={flowPalette.end}
        />

        <Model2Instanced
          positions={model2InstancePositions}
          scale={MODEL2_SCALE}
          onSelect={onSelectModel2}
        />
        <MatrixEnergyFenceWalls
          centers={model2MatrixAnchors}
          width={layout.matrixWidth + 0.36}
          depth={layout.matrixDepth + 0.36}
          height={Math.max(1.2, layout.model2TopY + 0.4)}
          baseY={0.04}
          wallColor={flowPalette.start}
          edgeColor={flowPalette.end}
        />
        <EnergyAnchorNodes
          anchors={model2MatrixAnchors}
          coreColor={flowPalette.end}
          ringColor={flowPalette.pulse}
        />
        <EnergyFlowLayer
          descriptors={energyDescriptors}
          isDay={preset.name === "白天航拍"}
        />

        <SceneEnvironment preset={preset} />
        <ContactShadows
          position={[0, -0.02, 0]}
          frames={1}
          resolution={512}
          opacity={preset.contactShadow.opacity}
          scale={preset.contactShadow.scale * 2.2}
          blur={preset.contactShadow.blur}
          far={preset.contactShadow.far * 1.5}
        />
      </Suspense>

      <OrbitControls
        makeDefault
        minDistance={2.5}
        maxDistance={70}
        target={[0, 0.6, 0]}
      />
      <BloomPassController threshold={0.9} strength={0.46} radius={0.3} />
    </>
  );
}

interface SiteTopologyFlowProps {
  dashboardData: SiteDashboardData;
  fullScreen?: boolean;
  embedded?: boolean;
}

export default function SiteTopologyFlow({
  dashboardData,
  fullScreen = false,
  embedded = false,
}: SiteTopologyFlowProps) {
  const [activePreset, setActivePreset] = useState<ScenePresetKey>("sunset");
  const [activeFlowScenarioId, setActiveFlowScenarioId] = useState("live");
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const model1DeviceInfos = useMemo(() => buildModel1DeviceInfos(), []);
  const model2DeviceInfos = useMemo(() => buildModel2DeviceInfos(), []);
  const preset = SCENE_PRESETS[activePreset];
  const isDay = activePreset === "midday";
  const chartPanelClass = isDay
    ? "border border-sky-200/90 bg-white/72"
    : "border border-orange-200/85 bg-white/72";
  const accentTextClass = isDay ? "text-sky-700" : "text-orange-700";
  const drawerClass = isDay
    ? "border border-sky-200/90 bg-white/82 shadow-[0_14px_30px_rgba(14,116,144,0.16)]"
    : "border border-orange-200/85 bg-white/84 shadow-[0_14px_30px_rgba(180,83,9,0.14)]";
  const edgeButtonClass = isDay
    ? "border border-sky-200/90 bg-white/90 text-sky-700 hover:bg-sky-50"
    : "border border-orange-200/90 bg-white/92 text-orange-700 hover:bg-orange-50";
  const overviewTileClass = isDay
    ? "border border-sky-200/80 bg-white/80 shadow-[0_6px_16px_rgba(14,116,144,0.08)]"
    : "border border-orange-200/80 bg-white/82 shadow-[0_6px_16px_rgba(180,83,9,0.08)]";
  const overviewTrackClass = isDay ? "bg-sky-100/80" : "bg-orange-100/80";
  const overviewFillClass = isDay
    ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500"
    : "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500";
  const scenarioPanelClass = isDay
    ? "border border-sky-200/90 bg-white/90"
    : "border border-orange-200/90 bg-white/90";
  const scenarioSelectClass = isDay
    ? "border-sky-200/90 bg-sky-50/40 text-slate-700"
    : "border-orange-200/90 bg-orange-50/40 text-slate-700";
  const modalPanelClass = isDay
    ? "border-sky-200/80 bg-white/94"
    : "border-orange-200/75 bg-white/94";
  const modalCardClass = isDay
    ? "border-sky-100/80 bg-white/88 shadow-[0_12px_30px_rgba(14,116,144,0.14)]"
    : "border-orange-100/80 bg-white/88 shadow-[0_12px_30px_rgba(180,83,9,0.14)]";
  const model1PreviewClass = isDay
    ? "border-sky-200/75 bg-gradient-to-br from-sky-50/85 via-white/85 to-cyan-100/80"
    : "border-orange-200/70 bg-gradient-to-br from-orange-50/85 via-white/85 to-amber-100/80";
  const model1MetricClass = isDay
    ? "border-sky-100/80 bg-white/92"
    : "border-orange-100/80 bg-white/92";
  const model1TrackClass = isDay ? "bg-sky-100/85" : "bg-orange-100/85";
  const model1FillClass = isDay
    ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500"
    : "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500";
  const model2ShellClass = isDay
    ? "border-sky-200/75 bg-gradient-to-br from-sky-50/90 via-white/90 to-cyan-100/80"
    : "border-orange-200/70 bg-gradient-to-br from-orange-50/90 via-white/90 to-amber-100/80";
  const model2CardClass = isDay
    ? "border-sky-100/80 bg-white/90"
    : "border-orange-100/80 bg-white/90";
  const model2TrackClass = isDay ? "bg-sky-100/80" : "bg-orange-100/80";
  const model2FillClass = isDay
    ? "bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500"
    : "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500";

  const handleSelectModel1 = (index: number) => {
    const info = model1DeviceInfos[index];
    if (!info) return;
    setSelectedDevice({ type: "model1", index, info });
  };

  const handleSelectModel2 = (index: number) => {
    const info = model2DeviceInfos[index];
    if (!info) return;
    setSelectedDevice({ type: "model2", index, info });
  };

  const activeFlowScenario = useMemo(
    () =>
      ENERGY_FLOW_TEST_SCENARIOS.find(
        (scenario) => scenario.id === activeFlowScenarioId,
      ) ?? ENERGY_FLOW_TEST_SCENARIOS[0],
    [activeFlowScenarioId],
  );
  const flowInput = useMemo<EnergyFlowInput>(() => {
    if (activeFlowScenario.id === "live") {
      return {
        pvPowerMw: dashboardData.pvPowerMw,
        storagePowerMw: dashboardData.storagePowerMw,
        loadPowerMw: dashboardData.loadPowerMw,
        gridPowerMw: dashboardData.gridPowerMw,
        hasWarning: dashboardData.hasWarning,
      };
    }

    return {
      pvPowerMw: activeFlowScenario.pvPowerMw,
      storagePowerMw: activeFlowScenario.storagePowerMw,
      loadPowerMw: activeFlowScenario.loadPowerMw,
      gridPowerMw: activeFlowScenario.gridPowerMw,
      hasWarning: activeFlowScenario.hasWarning,
    };
  }, [activeFlowScenario, dashboardData]);
  const flowModeText = flowInput.storagePowerMw >= 0 ? "充电流向" : "放电流向";
  const flowPowerText =
    flowInput.storagePowerMw >= 0
      ? `${flowInput.pvPowerMw.toFixed(2)} MW`
      : `${Math.abs(flowInput.storagePowerMw).toFixed(2)} MW`;

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
  const generationSeries = useMemo(() => {
    return sampledData.map((point, index) => {
      const modulation = 0.93 + 0.07 * Math.sin(index / 5);
      return Number(
        (Math.max(0, point.irradiance) * 0.062 * modulation).toFixed(2),
      );
    });
  }, [sampledData]);
  const socValue = useMemo(() => {
    const base =
      62 +
      dashboardData.pvPowerMw * 1.8 -
      Math.abs(dashboardData.storagePowerMw) * 2.6;
    return Number(Math.max(22, Math.min(95, base)).toFixed(1));
  }, [dashboardData.pvPowerMw, dashboardData.storagePowerMw]);
  const chargePower = Math.max(
    0,
    Number(dashboardData.storagePowerMw.toFixed(2)),
  );
  const dischargePower = Math.max(
    0,
    Number(Math.abs(Math.min(0, dashboardData.storagePowerMw)).toFixed(2)),
  );
  const loadComposition = useMemo(() => {
    const total = Math.max(1, dashboardData.loadPowerMw);
    const production = Number((total * 0.58).toFixed(2));
    const process = Number((total * 0.27).toFixed(2));
    const station = Number((total - production - process).toFixed(2));
    return { production, process, station };
  }, [dashboardData.loadPowerMw]);
  const inverterOnlineRate = dashboardData.hasWarning ? 95.1 : 99.2;
  const batteryClusterOnlineRate = dashboardData.hasWarning ? 93.7 : 98.3;
  const workOrderData = dashboardData.hasWarning
    ? { pending: 8, processing: 5, closed: 17 }
    : { pending: 3, processing: 2, closed: 24 };

  const leftIrradianceOptions = useMemo(
    () =>
      createTrendOptions({
        title: "辐照度",
        unit: "W/m²",
        color: isDay ? "#f59e0b" : "#fb923c",
        data: irradianceSeries,
        categories,
        isDay,
      }),
    [categories, irradianceSeries, isDay],
  );
  const leftWindOptions = useMemo(
    () =>
      createTrendOptions({
        title: "风速",
        unit: "m/s",
        color: isDay ? "#0ea5e9" : "#38bdf8",
        data: windSeries,
        categories,
        isDay,
      }),
    [categories, windSeries, isDay],
  );
  const leftGenerationOptions = useMemo(
    () =>
      createTrendOptions({
        title: "发电量",
        unit: "MW",
        color: isDay ? "#16a34a" : "#4ade80",
        data: generationSeries,
        categories,
        isDay,
      }),
    [categories, generationSeries, isDay],
  );

  const rightSocOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "pie",
        height: 240,
        backgroundColor: "transparent",
        spacing: [8, 8, 8, 8],
      },
      title: { text: undefined },
      credits: { enabled: false },
      tooltip: { pointFormat: "<b>{point.y:.1f}%</b>" },
      plotOptions: {
        pie: {
          innerSize: "68%",
          dataLabels: { enabled: false },
          borderWidth: 0,
        },
      },
      series: [
        {
          type: "pie",
          data: [
            { name: "SOC", y: socValue, color: isDay ? "#22c55e" : "#4ade80" },
            {
              name: "剩余",
              y: 100 - socValue,
              color: isDay ? "#dbeafe" : "#ffedd5",
            },
          ],
        },
      ],
    }),
    [isDay, socValue],
  );
  const rightChargeDischargeOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "column",
        height: 195,
        backgroundColor: "transparent",
        spacing: [8, 8, 8, 8],
      },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: {
        categories: ["充电", "放电"],
        labels: {
          style: { color: isDay ? "#475569" : "#9a3412", fontSize: "11px" },
        },
      },
      yAxis: {
        min: 0,
        title: { text: undefined },
        labels: {
          style: { color: isDay ? "#64748b" : "#9a3412", fontSize: "10px" },
        },
      },
      legend: { enabled: false },
      series: [
        {
          type: "column",
          data: [chargePower || 0.01, dischargePower || 0.01],
          colorByPoint: true,
          colors: [
            isDay ? "#22c55e" : "#4ade80",
            isDay ? "#f59e0b" : "#fb923c",
          ],
        },
      ],
    }),
    [chargePower, dischargePower, isDay],
  );
  const rightLoadCompositionOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "pie",
        height: 210,
        backgroundColor: "transparent",
        spacing: [8, 8, 8, 8],
      },
      title: { text: undefined },
      credits: { enabled: false },
      tooltip: { pointFormat: "<b>{point.y:.2f} MW</b>" },
      plotOptions: {
        pie: {
          innerSize: "55%",
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
              color: isDay ? "#6366f1" : "#818cf8",
            },
            {
              name: "工艺负载",
              y: loadComposition.process,
              color: isDay ? "#0ea5e9" : "#38bdf8",
            },
            {
              name: "站控负载",
              y: loadComposition.station,
              color: isDay ? "#14b8a6" : "#2dd4bf",
            },
          ],
        },
      ],
    }),
    [
      isDay,
      loadComposition.process,
      loadComposition.production,
      loadComposition.station,
    ],
  );

  const bottomOnlineRateOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "column",
        height: 200,
        backgroundColor: "transparent",
        spacing: [8, 8, 8, 8],
      },
      title: { text: undefined },
      credits: { enabled: false },
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
      legend: { enabled: false },
      tooltip: { valueSuffix: "%" },
      series: [
        {
          type: "column",
          data: [inverterOnlineRate, batteryClusterOnlineRate],
          colorByPoint: true,
          colors: [
            isDay ? "#22c55e" : "#4ade80",
            isDay ? "#0ea5e9" : "#38bdf8",
          ],
        },
      ],
    }),
    [batteryClusterOnlineRate, inverterOnlineRate, isDay],
  );
  const bottomAlarmOptions = useMemo<Highcharts.Options>(() => {
    const localAlarmCategories = [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
    ];
    const localAlarmSeries = dashboardData.hasWarning
      ? [1, 2, 3, 5, 4, 3, 2, 2]
      : [0, 1, 1, 2, 1, 1, 0, 1];

    return {
      chart: {
        type: "areaspline",
        height: 200,
        backgroundColor: "transparent",
        spacing: [8, 8, 8, 8],
      },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: {
        categories: localAlarmCategories,
        tickLength: 0,
        labels: {
          style: { color: isDay ? "#475569" : "#9a3412", fontSize: "10px" },
        },
      },
      yAxis: {
        title: { text: undefined },
        labels: {
          style: { color: isDay ? "#64748b" : "#9a3412", fontSize: "10px" },
        },
      },
      legend: { enabled: false },
      tooltip: { valueSuffix: " 条" },
      series: [
        {
          type: "areaspline",
          data: localAlarmSeries,
          color: isDay ? "#ef4444" : "#fb7185",
        },
      ],
      plotOptions: {
        areaspline: { marker: { enabled: false }, fillOpacity: 0.2 },
      },
    };
  }, [dashboardData.hasWarning, isDay]);
  const bottomWorkOrderOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "bar",
        height: 200,
        backgroundColor: "transparent",
        spacing: [8, 8, 8, 8],
      },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: {
        categories: ["待处理", "处理中", "已完成"],
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
      legend: { enabled: false },
      tooltip: { valueSuffix: " 单" },
      series: [
        {
          type: "bar",
          data: [
            workOrderData.pending,
            workOrderData.processing,
            workOrderData.closed,
          ],
          colorByPoint: true,
          colors: [
            isDay ? "#f59e0b" : "#fb923c",
            isDay ? "#0ea5e9" : "#38bdf8",
            isDay ? "#22c55e" : "#4ade80",
          ],
        },
      ],
    }),
    [
      isDay,
      workOrderData.closed,
      workOrderData.pending,
      workOrderData.processing,
    ],
  );

  const overviewItems = useMemo(() => {
    const capacity = Math.max(1, Number(dashboardData.capacity));
    const pvPct = Math.min(100, (dashboardData.pvPowerMw / capacity) * 100);
    const storagePct = Math.min(100, (Math.abs(dashboardData.storagePowerMw) / (capacity * 0.6)) * 100);
    const loadPct = Math.min(100, (dashboardData.loadPowerMw / capacity) * 100);
    const gridPct = Math.min(100, (Math.abs(dashboardData.gridPowerMw) / capacity) * 100);

    return [
      {
        icon: "☀",
        label: "光伏功率",
        value: `${dashboardData.pvPowerMw.toFixed(2)} MW`,
        progress: pvPct,
      },
      {
        icon: "↻",
        label: "储能功率",
        value: `${dashboardData.storagePowerMw >= 0 ? "充电" : "放电"} ${Math.abs(dashboardData.storagePowerMw).toFixed(2)} MW`,
        progress: storagePct,
      },
      {
        icon: "⌁",
        label: "负载功率",
        value: `${dashboardData.loadPowerMw.toFixed(2)} MW`,
        progress: loadPct,
      },
      {
        icon: "⇆",
        label: "并网/馈电",
        value: `${dashboardData.gridPowerMw >= 0 ? "并网" : "馈电"} ${Math.abs(dashboardData.gridPowerMw).toFixed(2)} MW`,
        progress: gridPct,
      },
      {
        icon: "♻",
        label: "减排效益",
        value: `CO₂ ${dashboardData.co2ReductionTons.toFixed(2)} 吨`,
        progress: Math.min(100, (dashboardData.co2ReductionTons / 10) * 100),
      },
      {
        icon: "🌱",
        label: "植树等效",
        value: `${dashboardData.treeEquivalent.toLocaleString()} 棵`,
        progress: Math.min(100, (dashboardData.treeEquivalent / 600) * 100),
      },
      {
        icon: "¥",
        label: "峰谷收益",
        value: `¥ ${dashboardData.arbitrageIncome.toLocaleString()}`,
        progress: Math.min(100, (dashboardData.arbitrageIncome / 20000) * 100),
      },
      {
        icon: "☁",
        label: "天气",
        value: dashboardData.weather,
        progress: dashboardData.weather.includes("晴")
          ? 92
          : dashboardData.weather.includes("多云")
            ? 72
            : dashboardData.weather.includes("阴")
              ? 58
              : 46,
      },
    ];
  }, [dashboardData]);

  return (
    <div
      className={
        embedded
          ? "relative h-full w-full overflow-hidden"
          : fullScreen
          ? `relative h-screen w-screen overflow-hidden ${
              isDay
                ? "border-0 bg-[#e7f5ff] shadow-none"
                : "border-0 bg-[#fff0e3] shadow-none"
            }`
          : `relative h-full min-h-[520px] w-full overflow-hidden rounded-2xl border ${
              isDay
                ? "border-sky-200/80 bg-[#e7f5ff] shadow-[0_16px_40px_rgba(14,116,144,0.18)]"
                : "border-orange-200/70 bg-[#fff0e3] shadow-[0_16px_40px_rgba(180,83,9,0.16)]"
            }`
      }
    >
      <Canvas
        dpr={[1, 1.25]}
        gl={{ powerPreference: "high-performance", antialias: true }}
        shadows={{ type: PCFSoftShadowMap }}
        camera={{ position: [8, 3.6, 12], fov: 45 }}
      >
        <color attach="background" args={[preset.background]} />
        <fog
          attach="fog"
          args={[preset.background, preset.fogNear, preset.fogFar]}
        />
        <Scene
          preset={preset}
          flowInput={flowInput}
          onSelectModel1={handleSelectModel1}
          onSelectModel2={handleSelectModel2}
        />
      </Canvas>

      {selectedDevice ? (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setSelectedDevice(null)}
        >
          <div
            className={`w-[900px] max-w-full rounded-2xl border p-3 shadow-[0_20px_40px_rgba(15,23,42,0.35)] ${modalPanelClass}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[11px] font-semibold tracking-[0.1em] uppercase ${accentTextClass}`}>
                  {selectedDevice.type === "model1" ? "电池设备详情" : "支架设备详情"}
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-slate-800">
                  {selectedDevice.type === "model1"
                    ? `Model1 #${selectedDevice.index + 1}`
                    : `Model2 支架 #${selectedDevice.index + 1}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${edgeButtonClass}`}
              >
                关闭
              </button>
            </div>

            {selectedDevice.type === "model1" ? (
              (() => {
                const snapshot = deriveModel1Snapshot(
                  selectedDevice.info,
                  selectedDevice.index,
                );
                const thermalBadgeClass =
                  snapshot.thermalLevel === "hot"
                    ? "border-rose-200/90 bg-rose-50/90 text-rose-700"
                    : snapshot.thermalLevel === "warning"
                      ? "border-amber-200/90 bg-amber-50/90 text-amber-700"
                      : "border-emerald-200/90 bg-emerald-50/90 text-emerald-700";
                const thermalLabel =
                  snapshot.thermalLevel === "hot"
                    ? "高温巡检"
                    : snapshot.thermalLevel === "warning"
                      ? "温升关注"
                      : "运行稳定";

                return (
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div
                      className={`overflow-hidden rounded-2xl border p-2 backdrop-blur-sm ${model1PreviewClass}`}
                    >
                      <div className="rounded-xl border border-white/45 bg-white/28 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-700">
                            电池簇状态
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${thermalBadgeClass}`}
                          >
                            {thermalLabel}
                          </span>
                        </div>
                        <div className="mt-2 h-[248px] overflow-hidden rounded-xl border border-white/55 bg-white/55">
                          <BatteryPreviewCanvas isDay={isDay} />
                        </div>
                        <div className="mt-2 rounded-xl border border-white/55 bg-white/58 p-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>SOC</span>
                            <span className="font-semibold text-slate-700">{snapshot.soc}%</span>
                          </div>
                          <div className={`mt-1 h-1.5 rounded-full ${model1TrackClass}`}>
                            <div
                              className={`h-full rounded-full ${model1FillClass}`}
                              style={{ width: `${snapshot.soc}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className={`rounded-xl border p-2.5 ${model1MetricClass}`}>
                          <p className="text-[11px] text-slate-500">电池容量</p>
                          <p className="mt-1 text-base font-semibold text-slate-800">
                            {selectedDevice.info.capacityKWh} kWh
                          </p>
                        </div>
                        <div className={`rounded-xl border p-2.5 ${model1MetricClass}`}>
                          <p className="text-[11px] text-slate-500">温度</p>
                          <p className="mt-1 text-base font-semibold text-slate-800">
                            {selectedDevice.info.temperature} °C
                          </p>
                        </div>
                        <div className={`rounded-xl border p-2.5 ${model1MetricClass}`}>
                          <p className="text-[11px] text-slate-500">电流</p>
                          <p className="mt-1 text-base font-semibold text-slate-800">
                            {selectedDevice.info.current} A
                          </p>
                        </div>
                        <div className={`rounded-xl border p-2.5 ${model1MetricClass}`}>
                          <p className="text-[11px] text-slate-500">电压</p>
                          <p className="mt-1 text-base font-semibold text-slate-800">
                            {selectedDevice.info.voltage} V
                          </p>
                        </div>
                      </div>

                      <div className={`rounded-xl border p-2.5 ${modalCardClass}`}>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-white/65 bg-white/75 p-2">
                            <p className="text-[11px] text-slate-500">工作模式</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {snapshot.workingMode}
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/65 bg-white/75 p-2">
                            <p className="text-[11px] text-slate-500">簇功率</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {snapshot.powerKw >= 0 ? "+" : ""}
                              {snapshot.powerKw} kW
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/65 bg-white/75 p-2">
                            <p className="text-[11px] text-slate-500">循环次数</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {snapshot.cycleCount}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2.5 space-y-1.5">
                          {[
                            { label: "健康指数", value: snapshot.healthIndex },
                            { label: "电压稳定性", value: snapshot.voltageStability },
                            { label: "热冗余", value: snapshot.thermalHeadroom },
                          ].map((item) => (
                            <div key={item.label}>
                              <div className="flex items-center justify-between text-[11px] text-slate-600">
                                <span>{item.label}</span>
                                <span className="font-semibold text-slate-700">{item.value}%</span>
                              </div>
                              <div className={`mt-1 h-1.5 rounded-full ${model1TrackClass}`}>
                                <div
                                  className={`h-full rounded-full ${model1FillClass}`}
                                  style={{ width: `${item.value}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              (() => {
                const snapshot = deriveModel2Snapshot(selectedDevice.info);
                const statusBadgeClass =
                  snapshot.statusLevel === "critical"
                    ? "border-rose-200/90 bg-rose-50/90 text-rose-700"
                    : snapshot.statusLevel === "warning"
                      ? "border-amber-200/90 bg-amber-50/90 text-amber-700"
                      : "border-emerald-200/90 bg-emerald-50/90 text-emerald-700";

                return (
                  <div className={`mt-3 rounded-2xl border p-2 ${model2ShellClass}`}>
                    <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)]">
                      <div className={`rounded-xl border p-2.5 ${model2CardClass}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-700">
                            跟踪控制舱
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass}`}
                          >
                            {snapshot.statusLabel}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-white/70 bg-white/78 p-2">
                            <p className="text-[11px] text-slate-500">当前角度</p>
                            <p className="mt-1 text-xl font-semibold text-slate-800">
                              {selectedDevice.info.actualAngle}°
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/70 bg-white/78 p-2">
                            <p className="text-[11px] text-slate-500">目标角度</p>
                            <p className="mt-1 text-xl font-semibold text-slate-800">
                              {selectedDevice.info.targetAngle}°
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 rounded-lg border border-white/70 bg-white/78 p-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>跟踪偏差</span>
                            <span className="font-semibold text-slate-700">
                              {snapshot.trackingError}°
                            </span>
                          </div>
                          <div className={`mt-1 h-1.5 rounded-full ${model2TrackClass}`}>
                            <div
                              className={`h-full rounded-full ${model2FillClass}`}
                              style={{
                                width: `${Math.max(8, Math.min(100, 100 - snapshot.trackingError * 18))}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-600">
                            {selectedDevice.info.workMode} · 在线闭环控制
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                          <div className={`rounded-xl border p-2 ${model2CardClass}`}>
                            <p className="text-[11px] text-slate-500">电机电流</p>
                            <p className="mt-1 text-base font-semibold text-slate-800">
                              {selectedDevice.info.motorCurrent} A
                            </p>
                          </div>
                          <div className={`rounded-xl border p-2 ${model2CardClass}`}>
                            <p className="text-[11px] text-slate-500">电机电压</p>
                            <p className="mt-1 text-base font-semibold text-slate-800">
                              {selectedDevice.info.motorVoltage} V
                            </p>
                          </div>
                          <div className={`rounded-xl border p-2 ${model2CardClass}`}>
                            <p className="text-[11px] text-slate-500">姿态对齐度</p>
                            <p className="mt-1 text-base font-semibold text-slate-800">
                              {snapshot.alignmentScore}%
                            </p>
                          </div>
                          <div className={`rounded-xl border p-2 ${model2CardClass}`}>
                            <p className="text-[11px] text-slate-500">控制稳定度</p>
                            <p className="mt-1 text-base font-semibold text-slate-800">
                              {snapshot.controlStability}%
                            </p>
                          </div>
                        </div>

                        <div className={`rounded-xl border p-2.5 ${model2CardClass}`}>
                          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
                            {[
                              { label: "电机负载", value: snapshot.motorLoad },
                              { label: "电压健康", value: snapshot.voltageHealth },
                              { label: "姿态对齐", value: snapshot.alignmentScore },
                            ].map((item) => (
                              <div key={item.label}>
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                  <span>{item.label}</span>
                                  <span className="font-semibold text-slate-700">{item.value}%</span>
                                </div>
                                <div className={`mt-1 h-1.5 rounded-full ${model2TrackClass}`}>
                                  <div
                                    className={`h-full rounded-full ${model2FillClass}`}
                                    style={{ width: `${item.value}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={`rounded-xl border p-2.5 ${model2CardClass}`}>
                          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-600">
                            告警流水
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {selectedDevice.info.alarms.length ? (
                              selectedDevice.info.alarms.map((alarm, idx) => (
                                <div
                                  key={`alarm-${selectedDevice.index}-${idx}`}
                                  className="flex items-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/70 px-2 py-1.5"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  <span className="text-xs text-rose-700">
                                    {alarm}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2 py-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-xs text-emerald-700">暂无告警</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      ) : null}

      {!embedded ? (
        <>
      <div className="absolute top-3 left-3 z-20">
        {overviewExpanded ? (
          <div
            className={`w-[640px] max-w-[72vw] rounded-2xl p-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.12)] backdrop-blur-md ${chartPanelClass}`}
          >
            <div className="pointer-events-auto flex items-start justify-between gap-2">
              <div>
                <p className={`text-[11px] font-semibold tracking-[0.1em] uppercase ${accentTextClass}`}>实时运营总览图</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-700">{dashboardData.siteName}</p>
                <p className="mt-0.5 text-xs text-slate-600">实时设备拓扑图与状态监控</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {dashboardData.location} · 容量 {dashboardData.capacity} MW · {dashboardData.weather}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverviewExpanded(false)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${edgeButtonClass}`}
                title="缩小总览浮窗"
              >
                －
              </button>
            </div>
            <div className="mt-2 pointer-events-auto rounded-xl border border-white/70 bg-white/65 p-2">
              <div className="mb-2 flex items-center justify-between rounded-lg border border-white/70 bg-white/70 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
                      isDay
                        ? "bg-sky-100 text-sky-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    ⚡
                  </span>
                  <p className="text-xs font-semibold text-slate-700">
                    实时运营状态
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    dashboardData.hasWarning
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {dashboardData.hasWarning ? "异常关注" : "运行稳定"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {overviewItems.map((item) => {
                  const safeProgress = Math.min(100, Math.max(0, item.progress));
                  return (
                    <div
                      key={item.label}
                      className={`rounded-lg px-2 py-1.5 ${overviewTileClass}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-slate-600">
                            {item.label}
                          </p>
                          <p className="truncate text-[13px] font-semibold text-slate-800">
                            {item.value}
                          </p>
                        </div>
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                            isDay
                              ? "bg-sky-100/90 text-sky-700"
                              : "bg-orange-100/90 text-orange-700"
                          }`}
                        >
                          {item.icon}
                        </span>
                      </div>
                      <div className={`mt-1.5 h-1.5 w-full overflow-hidden rounded-full ${overviewTrackClass}`}>
                        <div
                          className={`h-full rounded-full ${overviewFillClass}`}
                          style={{ width: `${safeProgress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOverviewExpanded(true)}
            className={`pointer-events-auto rounded-full p-2.5 shadow-sm transition-colors ${edgeButtonClass}`}
            title="放大总览浮窗"
          >
            📊
          </button>
        )}
      </div>

      <div
        className={`absolute top-4 right-4 z-20 flex items-center gap-2 rounded-xl p-1 shadow-sm backdrop-blur-sm ${
          isDay
            ? "border border-sky-200/90 bg-white/88"
            : "border border-orange-200/80 bg-white/88"
        }`}
      >
        <button
          type="button"
          onClick={() => setActivePreset("midday")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            activePreset === "midday"
              ? "bg-sky-500/25 text-sky-700"
              : "text-slate-700 hover:bg-sky-100"
          }`}
        >
          白天航拍
        </button>
        <button
          type="button"
          onClick={() => setActivePreset("sunset")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            activePreset === "sunset"
              ? "bg-orange-500/25 text-orange-700"
              : "text-slate-700 hover:bg-orange-100"
          }`}
        >
          傍晚暖光
        </button>
      </div>

      <div
        className={`absolute top-16 right-4 z-20 w-[248px] rounded-xl p-2 shadow-sm backdrop-blur-sm ${scenarioPanelClass}`}
      >
        <p className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${accentTextClass}`}>
          能量流测试场景
        </p>
        <select
          value={activeFlowScenarioId}
          onChange={(event) => setActiveFlowScenarioId(event.target.value)}
          className={`mt-1.5 w-full rounded-lg border px-2 py-1.5 text-xs outline-none transition-colors ${scenarioSelectClass}`}
        >
          {ENERGY_FLOW_TEST_SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-600">{activeFlowScenario.description}</p>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-700">{flowModeText}</span>
          <span className={flowInput.hasWarning ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>
            驱动功率 {flowPowerText}
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {leftPanelOpen ? (
          <div
            className={`pointer-events-auto absolute top-1/2 left-3 w-[420px] max-h-[90%] -translate-y-1/2 overflow-y-auto rounded-2xl p-3 ${drawerClass}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p
                className={`text-xs font-semibold tracking-[0.08em] uppercase ${accentTextClass}`}
              >
                环境与发电
              </p>
              <button
                type="button"
                onClick={() => setLeftPanelOpen(false)}
                className={`rounded-md px-2 py-1 text-xs ${edgeButtonClass}`}
              >
                ◀
              </button>
            </div>
            <div className="space-y-2">
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  辐照度
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={leftIrradianceOptions}
                />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  风速
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={leftWindOptions}
                />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  发电量
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={leftGenerationOptions}
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLeftPanelOpen(true)}
            className={`pointer-events-auto absolute top-1/2 left-3 -translate-y-1/2 rounded-full p-2.5 shadow-sm transition-colors ${edgeButtonClass}`}
            title="展开环境与发电图表"
          >
            ⟪
          </button>
        )}

        {rightPanelOpen ? (
          <div
            className={`pointer-events-auto absolute top-1/2 right-3 w-[420px] max-h-[90%] -translate-y-1/2 overflow-y-auto rounded-2xl p-3 ${drawerClass}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p
                className={`text-xs font-semibold tracking-[0.08em] uppercase ${accentTextClass}`}
              >
                储能与负载
              </p>
              <button
                type="button"
                onClick={() => setRightPanelOpen(false)}
                className={`rounded-md px-2 py-1 text-xs ${edgeButtonClass}`}
              >
                ▶
              </button>
            </div>
            <div className="space-y-2">
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  储能 SOC 环形图
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={rightSocOptions}
                />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  充放电功率对比
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={rightChargeDischargeOptions}
                />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  负载消耗构成
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={rightLoadCompositionOptions}
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRightPanelOpen(true)}
            className={`pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-2.5 shadow-sm transition-colors ${edgeButtonClass}`}
            title="展开储能与负载图表"
          >
            ⟫
          </button>
        )}

        {bottomPanelOpen ? (
          <div
            className={`pointer-events-auto absolute bottom-3 left-1/2 w-[calc(100%-2rem)] max-w-[1260px] -translate-x-1/2 rounded-2xl p-3 ${drawerClass}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p
                className={`text-xs font-semibold tracking-[0.08em] uppercase ${accentTextClass}`}
              >
                设备运行与运维
              </p>
              <button
                type="button"
                onClick={() => setBottomPanelOpen(false)}
                className={`rounded-md px-2 py-1 text-xs ${edgeButtonClass}`}
              >
                ▼
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  逆变器 / 电池簇在线率
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={bottomOnlineRateOptions}
                />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  实时告警流水
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={bottomAlarmOptions}
                />
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 p-2">
                <p className="px-1 text-[11px] font-semibold text-slate-600">
                  运维工单
                </p>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={bottomWorkOrderOptions}
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setBottomPanelOpen(true)}
            className={`pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full p-2.5 shadow-sm transition-colors ${edgeButtonClass}`}
            title="展开设备运行与运维图表"
          >
            ⌃
          </button>
        )}
      </div>
        </>
      ) : null}
    </div>
  );
}

useGLTF.preload("/1.glb");
useGLTF.preload("/2.glb");
useGLTF.preload("/battery.glb");
