import "server-only";

const PUBLIC_RUNTIME_CONFIG_KEYS = [
  "NEXT_PUBLIC_ROBOT_BASE_URL",
  "NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL",
  "NEXT_PUBLIC_PLANT_CREATED_WS_URL",
  "NEXT_PUBLIC_BATTERY_WS_URL",
  "NEXT_PUBLIC_TIANDITU_KEY",
] as const;

const RUNTIME_ENV_SOURCES = {
  NEXT_PUBLIC_ROBOT_BASE_URL: [
    "ROBOT_BASE_URL",
    "NEXT_PUBLIC_ROBOT_BASE_URL",
  ],
  NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL: [
    "ROBOT_VIDEO_BASE_URL",
    "NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL",
  ],
  NEXT_PUBLIC_PLANT_CREATED_WS_URL: [
    "PLANT_CREATED_WS_URL",
    "NEXT_PUBLIC_PLANT_CREATED_WS_URL",
  ],
  NEXT_PUBLIC_BATTERY_WS_URL: [
    "BATTERY_WS_URL",
    "NEXT_PUBLIC_BATTERY_WS_URL",
  ],
  NEXT_PUBLIC_TIANDITU_KEY: ["TIANDITU_KEY", "NEXT_PUBLIC_TIANDITU_KEY"],
} as const;

type PublicRuntimeConfigKey = (typeof PUBLIC_RUNTIME_CONFIG_KEYS)[number];
type PublicRuntimeConfig = Record<PublicRuntimeConfigKey, string>;

let hasWarnedAboutEmptyRuntimeConfig = false;

function readRuntimeEnvValue(keys: readonly string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function getRuntimePublicConfig(): PublicRuntimeConfig {
  const config = PUBLIC_RUNTIME_CONFIG_KEYS.reduce(
    (config, key) => {
      config[key] = readRuntimeEnvValue(RUNTIME_ENV_SOURCES[key]);
      return config;
    },
    {} as PublicRuntimeConfig,
  );

  if (
    !hasWarnedAboutEmptyRuntimeConfig &&
    Object.values(config).every((value) => value.length === 0)
  ) {
    hasWarnedAboutEmptyRuntimeConfig = true;
    console.warn(
      "[robot-dashboard] Runtime config is empty. Expected one of: ROBOT_BASE_URL / NEXT_PUBLIC_ROBOT_BASE_URL, ROBOT_VIDEO_BASE_URL / NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL, PLANT_CREATED_WS_URL / NEXT_PUBLIC_PLANT_CREATED_WS_URL, BATTERY_WS_URL / NEXT_PUBLIC_BATTERY_WS_URL, TIANDITU_KEY / NEXT_PUBLIC_TIANDITU_KEY.",
    );
  }

  return config;
}

export function getRuntimePublicConfigScript(): string {
  return `window.__ROBOT_DASHBOARD_RUNTIME_CONFIG__ = ${JSON.stringify(getRuntimePublicConfig())};\n`;
}
