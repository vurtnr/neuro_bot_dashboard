export type GlobalSitePointStatus = "connected" | "warning" | "unconnected";

export type GlobalSiteDetail = {
  siteType: string;
  operator: string;
  gridProfile: string;
  robotStatus: "在线待命" | "执行中" | "离线" | "充电中";
  todayInspectionStatus: "未执行" | "巡检中" | "已完成";
  dataAccessStatus: "已接入";
  anomalyReviewStatus: "无待复核" | "待复核1项";
  livePowerMw: number;
  todayGenerationMwh: number;
  ambientTempC: number;
  irradianceWm2: number;
  windSpeedMs: number;
  humidityPct: number;
  elevationM: number;
  localTimeLabel: string;
  lastSyncLabel: string;
  alertSummary: string;
};

export type GlobalSitePoint = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  status: GlobalSitePointStatus;
  capacityMw: number;
  connected: boolean;
  alertText?: string;
  details: GlobalSiteDetail;
};

export type GlobalSiteFeatureProperties = {
  id: string;
  name: string;
  region: string;
  status: GlobalSitePointStatus;
  capacityMw: number;
};

export type GlobalSiteFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: GlobalSiteFeatureProperties;
  }>;
};

export type GlobalSiteBounds = {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
};

type GlobalSiteClimate =
  | "desert"
  | "plateau"
  | "plain"
  | "mediterranean"
  | "tropical";

type GlobalSiteSeed = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  capacityMw: number;
  elevationM: number;
  status: GlobalSitePointStatus;
  siteType: string;
  operator: string;
  gridProfile: string;
  localTimeLabel: string;
  climate: GlobalSiteClimate;
};

const climateProfiles: Record<
  GlobalSiteClimate,
  {
    ambientTempC: number;
    irradianceWm2: number;
    windSpeedMs: number;
    humidityPct: number;
    generationFactor: number;
    connectedPowerFactor: number;
    warningPowerFactor: number;
  }
> = {
  desert: {
    ambientTempC: 36.4,
    irradianceWm2: 918,
    windSpeedMs: 5.8,
    humidityPct: 19,
    generationFactor: 6.3,
    connectedPowerFactor: 0.77,
    warningPowerFactor: 0.61,
  },
  plateau: {
    ambientTempC: 15.8,
    irradianceWm2: 828,
    windSpeedMs: 7.3,
    humidityPct: 26,
    generationFactor: 6.0,
    connectedPowerFactor: 0.75,
    warningPowerFactor: 0.6,
  },
  plain: {
    ambientTempC: 24.7,
    irradianceWm2: 734,
    windSpeedMs: 4.9,
    humidityPct: 43,
    generationFactor: 5.4,
    connectedPowerFactor: 0.71,
    warningPowerFactor: 0.58,
  },
  mediterranean: {
    ambientTempC: 27.2,
    irradianceWm2: 781,
    windSpeedMs: 4.4,
    humidityPct: 38,
    generationFactor: 5.7,
    connectedPowerFactor: 0.73,
    warningPowerFactor: 0.59,
  },
  tropical: {
    ambientTempC: 30.5,
    irradianceWm2: 752,
    windSpeedMs: 4.1,
    humidityPct: 61,
    generationFactor: 5.2,
    connectedPowerFactor: 0.69,
    warningPowerFactor: 0.55,
  },
};

const ambientOffsets = [0, 1.4, -1.2, 2.1, -0.8, 0.9, -1.6];
const irradianceOffsets = [18, -11, 7, -24, 13, -6, 21];
const windOffsets = [0, 0.5, -0.4, 0.7, -0.2, 0.3, -0.5];
const humidityOffsets = [0, 4, -3, 6, -2, 3, -5];
const syncTimes = ["23:12:08", "22:48:31", "21:56:14", "20:39:52", "19:27:06"];
const staleSyncTimes = ["16:22:47", "14:51:09", "13:18:25", "11:42:33"];

function getRobotStatus(
  seed: GlobalSiteSeed,
  index: number,
): GlobalSiteDetail["robotStatus"] {
  if (seed.status === "unconnected") {
    return "离线";
  }

  if (seed.status === "warning") {
    return "执行中";
  }

  return index % 4 === 0 ? "充电中" : "在线待命";
}

function getTodayInspectionStatus(
  seed: GlobalSiteSeed,
  index: number,
): GlobalSiteDetail["todayInspectionStatus"] {
  if (seed.status === "warning") {
    return "巡检中";
  }

  if (seed.status === "unconnected") {
    return "未执行";
  }

  return index % 3 === 0 ? "未执行" : "已完成";
}

function buildAlertCopy(seed: GlobalSiteSeed) {
  if (seed.status === "warning") {
    const warningText =
      seed.climate === "desert" || seed.climate === "plateau"
        ? "组件温升偏高，建议安排热像复核"
        : "关键组串输出波动，建议安排现场排查";

    return {
      alertText: `${seed.name}${warningText}`,
      alertSummary: `${seed.siteType}运行存在波动，当前已进入重点关注队列`,
    };
  }

  if (seed.status === "unconnected") {
    return {
      alertSummary: "远程链路暂未恢复，当前等待边缘网关重新上线",
    };
  }

  return {
    alertSummary: "运行稳定，遥测数据与并网功率保持正常",
  };
}

function toGlobalSitePoint(seed: GlobalSiteSeed, index: number): GlobalSitePoint {
  const profile = climateProfiles[seed.climate];
  const connected = seed.status !== "unconnected";
  const powerFactor =
    seed.status === "warning"
      ? profile.warningPowerFactor
      : profile.connectedPowerFactor;
  const livePowerMw = connected
    ? Number((seed.capacityMw * powerFactor).toFixed(1))
    : 0;
  const todayGenerationMwh = Number(
    (seed.capacityMw * profile.generationFactor + (index * 2.4)).toFixed(1),
  );
  const ambientTempC = Number(
    (profile.ambientTempC + ambientOffsets[index % ambientOffsets.length]).toFixed(1),
  );
  const irradianceWm2 =
    profile.irradianceWm2 + irradianceOffsets[index % irradianceOffsets.length];
  const windSpeedMs = Number(
    (profile.windSpeedMs + windOffsets[index % windOffsets.length]).toFixed(1),
  );
  const humidityPct =
    profile.humidityPct + humidityOffsets[index % humidityOffsets.length];
  const alertCopy = buildAlertCopy(seed);

  return {
    id: seed.id,
    name: seed.name,
    region: seed.region,
    lat: seed.lat,
    lng: seed.lng,
    status: seed.status,
    capacityMw: seed.capacityMw,
    connected,
    alertText: alertCopy.alertText,
    details: {
      siteType: seed.siteType,
      operator: seed.operator,
      gridProfile: seed.gridProfile,
      robotStatus: getRobotStatus(seed, index),
      todayInspectionStatus: getTodayInspectionStatus(seed, index),
      dataAccessStatus: "已接入",
      anomalyReviewStatus: "无待复核",
      livePowerMw,
      todayGenerationMwh,
      ambientTempC,
      irradianceWm2,
      windSpeedMs,
      humidityPct,
      elevationM: seed.elevationM,
      localTimeLabel: seed.localTimeLabel,
      lastSyncLabel: connected
        ? syncTimes[index % syncTimes.length]
        : staleSyncTimes[index % staleSyncTimes.length],
      alertSummary: alertCopy.alertSummary,
    },
  };
}

const globalSiteSeeds: GlobalSiteSeed[] = [
  {
    id: "sichuan-yalongjiang",
    name: "Sichuan/雅砻江",
    region: "中国 四川",
    lat: 29.95,
    lng: 100.62,
    capacityMw: 31,
    elevationM: 2510,
    status: "connected",
    siteType: "高山河谷光储站",
    operator: "西南流域新能源监测中心",
    gridProfile: "220 千伏并网",
    localTimeLabel: "2026-03-30 23:11 UTC+8",
    climate: "plateau",
  },
  {
    id: "qinghai-gonghexian",
    name: "Qinghai/gonghexian",
    region: "中国 青海",
    lat: 36.17,
    lng: 100.42,
    capacityMw: 34,
    elevationM: 2895,
    status: "connected",
    siteType: "高原地面光伏站",
    operator: "青藏高原新能源调度平台",
    gridProfile: "330 千伏汇集外送",
    localTimeLabel: "2026-03-30 23:11 UTC+8",
    climate: "plateau",
  },
  {
    id: "shandong-dongying",
    name: "Shandong/东营",
    region: "中国 山东",
    lat: 37.4,
    lng: 118.89,
    capacityMw: 26,
    elevationM: 12,
    status: "warning",
    siteType: "盐碱地光伏场",
    operator: "华北智慧运维中心",
    gridProfile: "220 千伏并网",
    localTimeLabel: "2026-03-30 23:11 UTC+8",
    climate: "plain",
  },
  {
    id: "xinjiang-urumqi",
    name: "新疆/乌鲁木齐",
    region: "中国 新疆",
    lat: 42.67,
    lng: 93.71,
    capacityMw: 33,
    elevationM: 915,
    status: "connected",
    siteType: "戈壁地面电站",
    operator: "西域新能源远程运维中心",
    gridProfile: "220 千伏并网",
    localTimeLabel: "2026-03-30 23:11 UTC+8",
    climate: "desert",
  },
  {
    id: "rajasthan-bhadla",
    name: "Rajasthan Bhadla",
    region: "印度 拉贾斯坦邦",
    lat: 27.52,
    lng: 71.94,
    capacityMw: 38,
    elevationM: 312,
    status: "warning",
    siteType: "沙漠超大基地",
    operator: "印度西部新能源控制台",
    gridProfile: "400 千伏升压并网",
    localTimeLabel: "2026-03-30 22:41 UTC+5:30",
    climate: "desert",
  },
  {
    id: "gujarat-khavda",
    name: "Gujerat Khavda RE Park",
    region: "印度 古吉拉特邦",
    lat: 23.84,
    lng: 69.73,
    capacityMw: 42,
    elevationM: 61,
    status: "connected",
    siteType: "荒漠新能源园区",
    operator: "西印度联合调度平台",
    gridProfile: "400 千伏并网",
    localTimeLabel: "2026-03-30 22:41 UTC+5:30",
    climate: "desert",
  },
  {
    id: "australia-nsw",
    name: "NSW",
    region: "澳大利亚 新南威尔士州",
    lat: -34.32,
    lng: 146.13,
    capacityMw: 24,
    elevationM: 216,
    status: "connected",
    siteType: "内陆平原光伏站",
    operator: "澳东电网远程调控台",
    gridProfile: "220 千伏并网",
    localTimeLabel: "2026-03-31 03:06 UTC+11",
    climate: "plain",
  },
  {
    id: "australia-queensland",
    name: "Queensland",
    region: "澳大利亚 昆士兰州",
    lat: -20.87,
    lng: 144.21,
    capacityMw: 27,
    elevationM: 328,
    status: "connected",
    siteType: "内陆荒漠光储站",
    operator: "澳洲北部远程运维中心",
    gridProfile: "132 千伏并网",
    localTimeLabel: "2026-03-31 02:06 UTC+10",
    climate: "desert",
  },
  {
    id: "spain-castile-la-mancha",
    name: "Castile La Mancha",
    region: "西班牙 卡斯蒂利亚-拉曼恰",
    lat: 39.18,
    lng: -3.28,
    capacityMw: 29,
    elevationM: 684,
    status: "connected",
    siteType: "高原地面光伏站",
    operator: "伊比利亚新能源监测中心",
    gridProfile: "220 千伏并网",
    localTimeLabel: "2026-03-30 16:11 UTC+1",
    climate: "mediterranean",
  },
  {
    id: "spain-andalusia",
    name: "Andalusia",
    region: "西班牙 安达卢西亚",
    lat: 37.55,
    lng: -5.33,
    capacityMw: 32,
    elevationM: 562,
    status: "warning",
    siteType: "地中海光储联合站",
    operator: "南欧新能源运维网络",
    gridProfile: "220 千伏升压并网",
    localTimeLabel: "2026-03-30 16:11 UTC+1",
    climate: "mediterranean",
  },
  {
    id: "spain-castile-leon",
    name: "Castile and Leon",
    region: "西班牙 卡斯蒂利亚-莱昂",
    lat: 41.81,
    lng: -4.47,
    capacityMw: 25,
    elevationM: 842,
    status: "connected",
    siteType: "内陆台地光伏场",
    operator: "北伊比利亚智能调度平台",
    gridProfile: "220 千伏并网",
    localTimeLabel: "2026-03-30 16:11 UTC+1",
    climate: "plain",
  },
  {
    id: "italy-roma",
    name: "Roma",
    region: "意大利 罗马",
    lat: 41.76,
    lng: 12.51,
    capacityMw: 21,
    elevationM: 24,
    status: "connected",
    siteType: "城郊分布式集群",
    operator: "意大利中部运维平台",
    gridProfile: "150 千伏接入",
    localTimeLabel: "2026-03-30 16:11 UTC+1",
    climate: "mediterranean",
  },
  {
    id: "brazil-mg",
    name: "米纳斯吉拉斯州 (MG)",
    region: "巴西 米纳斯吉拉斯州",
    lat: -19.34,
    lng: -42.56,
    capacityMw: 30,
    elevationM: 862,
    status: "connected",
    siteType: "高原光伏园区",
    operator: "巴西东南联合运维中心",
    gridProfile: "230 千伏并网",
    localTimeLabel: "2026-03-30 12:11 UTC-3",
    climate: "tropical",
  },
  {
    id: "brazil-ba",
    name: "巴伊亚州 (BA)",
    region: "巴西 巴伊亚州",
    lat: -12.75,
    lng: -43.96,
    capacityMw: 28,
    elevationM: 436,
    status: "warning",
    siteType: "热带高辐照光伏场",
    operator: "巴西东北远程监控中心",
    gridProfile: "230 千伏并网",
    localTimeLabel: "2026-03-30 12:11 UTC-3",
    climate: "tropical",
  },
  {
    id: "brazil-pi",
    name: "皮奥伊州 (PI)",
    region: "巴西 皮奥伊州",
    lat: -5.1,
    lng: -41.86,
    capacityMw: 27,
    elevationM: 312,
    status: "connected",
    siteType: "半干旱地面光伏站",
    operator: "巴西北部清洁能源平台",
    gridProfile: "230 千伏并网",
    localTimeLabel: "2026-03-30 12:11 UTC-3",
    climate: "tropical",
  },
  {
    id: "chile-antofagasta",
    name: "Antofagasta",
    region: "智利 安托法加斯塔",
    lat: -22.59,
    lng: -68.68,
    capacityMw: 35,
    elevationM: 2440,
    status: "connected",
    siteType: "高海拔荒漠光伏站",
    operator: "安第斯新能源调度中心",
    gridProfile: "220 千伏外送",
    localTimeLabel: "2026-03-30 12:11 UTC-4",
    climate: "desert",
  },
  {
    id: "chile-santiago",
    name: "Santiago",
    region: "智利 圣地亚哥",
    lat: -33.08,
    lng: -70.85,
    capacityMw: 23,
    elevationM: 518,
    status: "unconnected",
    siteType: "山前储能支撑站",
    operator: "智利中部调频中心",
    gridProfile: "154 千伏接入",
    localTimeLabel: "2026-03-30 12:11 UTC-4",
    climate: "mediterranean",
  },
  {
    id: "argentina-north",
    name: "Argentina",
    region: "阿根廷 北部内陆",
    lat: -25.34,
    lng: -62.6,
    capacityMw: 26,
    elevationM: 408,
    status: "connected",
    siteType: "内陆地面光伏场",
    operator: "阿根廷北部远程运维台",
    gridProfile: "220 千伏并网",
    localTimeLabel: "2026-03-30 12:11 UTC-3",
    climate: "plain",
  },
  {
    id: "usa-texas",
    name: "Texas",
    region: "美国 得州",
    lat: 29.22,
    lng: -99.7,
    capacityMw: 31,
    elevationM: 264,
    status: "warning",
    siteType: "内陆光储联合站",
    operator: "北美南部运维中心",
    gridProfile: "345 千伏并网",
    localTimeLabel: "2026-03-30 10:11 UTC-5",
    climate: "plain",
  },
  {
    id: "usa-california",
    name: "California",
    region: "美国 加州",
    lat: 35.61,
    lng: -119.83,
    capacityMw: 33,
    elevationM: 458,
    status: "connected",
    siteType: "荒漠边缘电站",
    operator: "北美西部新能源调度中心",
    gridProfile: "500 千伏外送",
    localTimeLabel: "2026-03-30 08:11 UTC-7",
    climate: "desert",
  },
  {
    id: "usa-indiana",
    name: "Indiana",
    region: "美国 印第安纳州",
    lat: 40.08,
    lng: -85.12,
    capacityMw: 20,
    elevationM: 218,
    status: "unconnected",
    siteType: "农光互补试验站",
    operator: "北美中部试验运维网络",
    gridProfile: "138 千伏接入",
    localTimeLabel: "2026-03-30 11:11 UTC-4",
    climate: "plain",
  },
  {
    id: "usa-florida",
    name: "Florida",
    region: "美国 佛州",
    lat: 29.79,
    lng: -81.66,
    capacityMw: 22,
    elevationM: 7,
    status: "connected",
    siteType: "湿热环境分布式集群",
    operator: "北美东南边缘运维中心",
    gridProfile: "115 千伏接入",
    localTimeLabel: "2026-03-30 11:11 UTC-4",
    climate: "tropical",
  },
  {
    id: "saudi-jeddah",
    name: "吉达",
    region: "沙特 吉达",
    lat: 22.3,
    lng: 39.11,
    capacityMw: 30,
    elevationM: 18,
    status: "warning",
    siteType: "干热区并网电站",
    operator: "阿拉伯半岛新能源监测平台",
    gridProfile: "380 千伏并网",
    localTimeLabel: "2026-03-30 18:11 UTC+3",
    climate: "desert",
  },
];

export const globalSitePoints: GlobalSitePoint[] = globalSiteSeeds.map((seed, index) =>
  toGlobalSitePoint(seed, index),
);

export type GlobalSummary = {
  totalSites: number;
  connectedSites: number;
  onlineRate: number;
  totalCapacityMw: number;
  warningCount: number;
  unconnectedCount: number;
  plannedSiteCount: number;
};

export function getGlobalSummary(
  points: GlobalSitePoint[],
  plannedSiteCount = 0,
): GlobalSummary {
  const totalSites = points.length;
  const connectedSites = points.filter((point) => point.connected).length;
  const onlineRate = totalSites === 0 ? 0 : (connectedSites / totalSites) * 100;
  const totalCapacityMw = points.reduce((sum, point) => sum + point.capacityMw, 0);
  const warningCount = points.filter((point) => point.status === "warning").length;
  const unconnectedCount = points.filter(
    (point) => point.status === "unconnected",
  ).length;

  return {
    totalSites,
    connectedSites,
    onlineRate,
    totalCapacityMw,
    warningCount,
    unconnectedCount,
    plannedSiteCount,
  };
}

export function getAlertFeed(points: GlobalSitePoint[]) {
  const alerts = points
    .filter((point) => point.alertText)
    .map((point) => point.alertText as string);

  return alerts.length > 0 ? alerts : ["全球运行平稳，当前无新增告警"];
}

export function getStatusLabel(status: GlobalSitePointStatus) {
  switch (status) {
    case "connected":
      return "在线";
    case "warning":
      return "告警";
    case "unconnected":
      return "离线";
    default:
      return "未知";
  }
}

export function toGlobalSiteFeatureCollection(
  points: GlobalSitePoint[],
): GlobalSiteFeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lng, point.lat],
      },
      properties: {
        id: point.id,
        name: point.name,
        region: point.region,
        status: point.status,
        capacityMw: point.capacityMw,
      },
    })),
  };
}

export function getGlobalSiteBounds(points: GlobalSitePoint[]) {
  if (points.length === 0) {
    return null;
  }

  return points.reduce<GlobalSiteBounds>(
    (bounds, point) => ({
      minLng: Math.min(bounds.minLng, point.lng),
      maxLng: Math.max(bounds.maxLng, point.lng),
      minLat: Math.min(bounds.minLat, point.lat),
      maxLat: Math.max(bounds.maxLat, point.lat),
    }),
    {
      minLng: points[0].lng,
      maxLng: points[0].lng,
      minLat: points[0].lat,
      maxLat: points[0].lat,
    },
  );
}
