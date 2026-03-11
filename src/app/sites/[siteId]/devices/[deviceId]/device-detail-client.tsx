"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

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

function parseDeviceType(value: string | null): NodeDeviceType {
  return value === "cabinet" ? "cabinet" : "ncu";
}

function buildMetrics(type: NodeDeviceType, seed: number, hasWarning: boolean): DeviceMetric[] {
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

  const actualAngle = (15 + (seed % 12) * 2.1).toFixed(1);
  const targetAngle = (Number(actualAngle) + (seed % 3 === 0 ? 1.2 : -0.8)).toFixed(1);
  const motorCurrent = (2.3 + (seed % 8) * 0.34).toFixed(2);
  const motorVoltage = (24.4 + (seed % 6) * 0.8).toFixed(1);

  return [
    { label: "实际角度", value: `${actualAngle}°`, trend: "实时追日" },
    { label: "目标角度", value: `${targetAngle}°`, trend: "模型下发" },
    { label: "电机电流", value: `${motorCurrent} A`, trend: hasWarning ? "扭矩偏高" : "负载正常" },
    { label: "电机电压", value: `${motorVoltage} V`, trend: "驱动稳定" },
    {
      label: "跟踪偏差",
      value: `${Math.abs(Number(actualAngle) - Number(targetAngle)).toFixed(1)}°`,
      trend: "闭环修正中",
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

export default function DeviceDetailClient({
  siteId,
  siteName,
  hasWarning,
}: DeviceDetailClientProps) {
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nodeType = parseDeviceType(searchParams.get("nodeType"));
  const nodeLabel =
    searchParams.get("nodeLabel") ||
    (nodeType === "cabinet" ? "储能电柜 E1" : "N1");
  const hasWorkOrder = searchParams.get("hasWorkOrder") === "0" ? false : true;
  const seed = Number((searchParams.get("nodeId") ?? nodeLabel).match(/\d+/)?.[0] ?? "1");
  const metrics = useMemo(
    () => buildMetrics(nodeType, seed, hasWarning),
    [nodeType, seed, hasWarning],
  );
  const timeline = useMemo(
    () => buildTimeline(nodeType, hasWarning || hasWorkOrder),
    [nodeType, hasWarning, hasWorkOrder],
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
  const healthChartOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "pie",
        height: 220,
        backgroundColor: "transparent",
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: {
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { fontSize: "11px", color: "#334155" },
      },
      tooltip: { pointFormat: "<b>{point.percentage:.1f}%</b>" },
      plotOptions: {
        pie: {
          innerSize: "62%",
          dataLabels: { enabled: false },
          borderWidth: 0,
        },
      },
      series: [
        {
          type: "pie",
          name: "占比",
          data: [
            { name: "正常", y: hasWarning ? 68 : 82, color: "#22c55e" },
            { name: "告警", y: hasWarning ? 20 : 10, color: "#f59e0b" },
            { name: "工单", y: hasWorkOrder ? 12 : 8, color: "#ef4444" },
          ],
        },
      ],
    }),
    [hasWarning, hasWorkOrder],
  );
  const deviceTypeLabel = nodeType === "cabinet" ? "储能电柜节点" : "光伏支架节点";
  const statusLabel = hasWarning || hasWorkOrder ? "异常关注" : "运行正常";
  const cameraCaptures = useMemo(
    () =>
      nodeType === "cabinet"
        ? [
            { time: "14:28:12", tag: "热成像", note: "簇温升区域" },
            { time: "14:20:44", tag: "可见光", note: "接线端子" },
            { time: "14:16:03", tag: "热成像", note: "PCS接口位" },
          ]
        : [
            { time: "14:28:12", tag: "可见光", note: "驱动电机" },
            { time: "14:20:44", tag: "可见光", note: "支架连杆" },
            { time: "14:16:03", tag: "热成像", note: "轴承温升" },
          ],
    [nodeType],
  );
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_8%,#bfdbfe_0%,#e0f2fe_30%,#f8fafc_68%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 p-4 md:p-6">
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
                    hasWarning || hasWorkOrder
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {statusLabel}
                </span>
                <Link
                  href={`/sites/${siteId}`}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  返回场站
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                disabled={!hasWorkOrder}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  hasWorkOrder
                    ? "bg-sky-600 text-white shadow-[0_8px_20px_rgba(2,132,199,0.32)] hover:bg-sky-700"
                    : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                {hasWorkOrder ? "处理工单" : "暂无工单"}
              </button>
            </div>
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

        <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <div className="space-y-4">
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
          </div>

          <aside className="space-y-4">
            <article className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <p className="text-sm font-semibold text-slate-700">设备运行画像</p>
              <div className="mt-3 rounded-xl border border-sky-100/80 bg-gradient-to-br from-sky-50/80 to-white p-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>类型</span>
                  <span className="font-semibold text-slate-800">{deviceTypeLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>工单状态</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      hasWorkOrder ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {hasWorkOrder ? "待处理" : "无工单"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>当前模式</span>
                  <span className="font-semibold text-slate-800">
                    {nodeType === "cabinet" ? "功率调度" : "追日跟踪"}
                  </span>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <p className="text-sm font-semibold text-slate-700">健康状态构成</p>
              <div className="mt-2">
                <HighchartsReact highcharts={Highcharts} options={healthChartOptions} />
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/85 bg-white/92 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.07)]">
              <p className="text-sm font-semibold text-slate-700">状态流水</p>
              <div className="mt-3 space-y-2">
                {timeline.map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-300 ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
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
                    高优先级
                  </span>
                  <span className="text-slate-500">创建于：今天 09:15</span>
                </div>
                <h2 className="text-2xl font-semibold text-slate-800">
                  {siteName} - {nodeLabel} 工单处理
                </h2>
                <p className="mt-1 text-xs text-slate-500">工单号：WO-2023-0891</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                关闭
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-800">机器人摄像头回传</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  在线
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_162px]">
                <div className="rounded-xl border border-slate-200 bg-slate-950 p-2 shadow-inner">
                  <div className="relative flex h-[210px] items-center justify-center overflow-hidden rounded-lg border border-slate-700/70 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.24),rgba(2,6,23,0.95))]">
                    <div className="absolute top-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                      RTSP-ROBOT-CAM-01
                    </div>
                    <div className="absolute top-2 right-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                      1920x1080 · 25fps
                    </div>
                    <div className="text-center text-sm font-medium text-sky-100">
                      实时视频流接入位
                    </div>
                    <div className="absolute bottom-2 left-2 rounded bg-slate-900/75 px-2 py-0.5 text-[10px] text-slate-200">
                      {siteName} / {nodeLabel}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                    >
                      抓拍
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                    >
                      录像
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {cameraCaptures.map((capture) => (
                    <div
                      key={`${capture.time}-${capture.note}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                    >
                      <div className="h-[62px] rounded-md border border-slate-300 bg-gradient-to-br from-slate-200 to-slate-100" />
                      <p className="mt-1 text-[10px] font-semibold text-slate-700">
                        {capture.tag} · {capture.time}
                      </p>
                      <p className="text-[10px] text-slate-500">{capture.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-lg font-semibold text-slate-800">故障诊断</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-600">故障组件</span>
                  <select className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500">
                    <option>{nodeType === "cabinet" ? "储能电柜簇 1" : "光伏支架模块 3"}</option>
                    <option>{nodeType === "cabinet" ? "PCS 逆变器接口" : "驱动电机"}</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-600">故障模式</span>
                  <select className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500">
                    <option>{nodeType === "cabinet" ? "过温 / 电压波动" : "过扭 / 热异常"}</option>
                    <option>{nodeType === "cabinet" ? "低 SOC 保护" : "角度跟踪偏差"}</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block space-y-1">
                <span className="text-xs font-semibold text-slate-600">诊断结果</span>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500"
                  placeholder="详细说明判定根因与处理建议..."
                />
              </label>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-lg font-semibold text-slate-800">维修操作</p>
              <label className="mt-3 block space-y-1">
                <span className="text-xs font-semibold text-slate-600">执行操作</span>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500"
                  placeholder="描述已完成/计划执行的维修步骤..."
                />
              </label>
              <div className="mt-3">
                <span className="text-xs font-semibold text-slate-600">更换/使用的部件</span>
                <div className="mt-1 flex gap-2">
                  <input
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
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-800">证据与照片</p>
                <button type="button" className="text-xs font-semibold text-sky-700 hover:text-sky-800">
                  从机器人导入
                </button>
              </div>
              <div className="mt-3 flex h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                点击上传故障文件（SVG、PNG、JPG、PDF，最大 10MB）
              </div>
            </section>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                保存草稿
              </button>
              <button
                type="button"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(3,105,161,0.25)] hover:bg-sky-700"
              >
                提交处理结果
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
