"use client";

import { Suspense, useMemo, useRef, useState } from "react";
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
  OrbitControls,
  Sky,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  Box3,
  PCFSoftShadowMap,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Material,
  type Mesh,
} from "three";
import type { GLTF } from "three-stdlib";
import { generateMinuteLevelData } from "@/utils";

const MODEL2_MATRIX = {
  rows: 3,
  cols: 5,
};

const CLUSTER_COUNT = 3;
const MODEL2_HORIZONTAL_GROUP_COUNT = 3;
const MODEL1_TARGET_COUNT = 10;
const MODEL1_SCALE = 3;
const MODEL2_SCALE = 0.25;
const MODEL2_INNER_SPACING_FACTOR = 1.08;
const MATRIX_GROUP_SPACING_FACTOR = 1.05;
const CLUSTER_SPACING_FACTOR = 1.25;
const MODEL1_MATRIX_SEPARATION_FACTOR = 1.15;

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
    environment: "city" as const,
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
    environment: "sunset" as const,
    groundColor: "#d6d0ca",
    contactShadow: { opacity: 0.72, scale: 100, blur: 2.2, far: 55 },
  },
};

type ScenePresetKey = keyof typeof SCENE_PRESETS;
type ScenePreset = (typeof SCENE_PRESETS)[ScenePresetKey];

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
}: {
  positions: [number, number, number][];
  scale: number;
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
            />
          ))}
        </Instances>
      ))}
    </group>
  );
}

function Scene({ preset }: { preset: ScenePreset }) {
  const model1Ref = useRef<null | Group>(null);
  const model2SampleRef = useRef<null | Group>(null);
  const model2Scene = (useGLTF("/2.glb") as GLTF).scene;
  const [layout, setLayout] = useState({
    spacingX: 5,
    spacingZ: 5,
    matrixGroupSpacingX: 18,
    model1X: -12,
    clusterSpacingZ: 18,
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

    setLayout({
      spacingX,
      spacingZ,
      matrixGroupSpacingX,
      model1X,
      clusterSpacingZ,
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

  const gapModel1ZOffsets = clusterZOffsets
    .slice(0, -1)
    .map((zOffset, idx) => (zOffset + clusterZOffsets[idx + 1]) * 0.5);
  const baseModel1ZOffsets = [...clusterZOffsets, ...gapModel1ZOffsets].sort(
    (a, b) => a - b,
  );
  const model1MinZ = baseModel1ZOffsets[0] ?? 0;
  const model1MaxZ = baseModel1ZOffsets[baseModel1ZOffsets.length - 1] ?? 0;

  const model1ZOffsets = Array.from(
    { length: MODEL1_TARGET_COUNT },
    (_, idx) => {
      const denominator = Math.max(1, MODEL1_TARGET_COUNT - 1);
      const t = idx / denominator;
      return model1MinZ + (model1MaxZ - model1MinZ) * t;
    },
  );

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
          >
            <Model1 />
          </group>
        ))}

        <Model2Instanced
          positions={model2InstancePositions}
          scale={MODEL2_SCALE}
        />

        <Environment preset={preset.environment} />
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
    </>
  );
}

interface SiteTopologyFlowProps {
  dashboardData: SiteDashboardData;
  fullScreen?: boolean;
}

export default function SiteTopologyFlow({
  dashboardData,
  fullScreen = false,
}: SiteTopologyFlowProps) {
  const [activePreset, setActivePreset] = useState<ScenePresetKey>("midday");
  const [overviewExpanded, setOverviewExpanded] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
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
        fullScreen
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
        <Scene preset={preset} />
      </Canvas>

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
    </div>
  );
}

useGLTF.preload("/1.glb");
useGLTF.preload("/2.glb");
