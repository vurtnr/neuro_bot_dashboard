export const DEFAULT_BATTERY_TELEMETRY_LIMIT = 60;

export type BatteryTelemetryPoint = {
  isoTimestamp: string;
  timeLabel: string;
  soc: number;
  status: string;
  isCharging: boolean;
  isDischarging: boolean;
  maxVoltage: number;
  minVoltage: number;
  maxTemp: number;
  minTemp: number;
  activePower: number;
};

type BatteryTelemetryEnvelope = {
  type?: unknown;
  data?: Record<string, unknown>;
};

function readNumericField(
  value: unknown,
): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBooleanField(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readStringField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function formatTimeLabel(timestamp: string): string | null {
  const matched = timestamp.match(/T(\d{2}:\d{2}:\d{2})/);
  return matched?.[1] ?? null;
}

export function parseBatteryTelemetryMessage(
  raw: string,
): BatteryTelemetryPoint | null {
  let payload: BatteryTelemetryEnvelope;

  try {
    payload = JSON.parse(raw) as BatteryTelemetryEnvelope;
  } catch {
    return null;
  }

  if (payload.type !== "battery:update" || !payload.data) {
    return null;
  }

  const isoTimestamp = readStringField(payload.data.timestamp);
  const timeLabel = isoTimestamp ? formatTimeLabel(isoTimestamp) : null;
  const soc = readNumericField(payload.data.soc);
  const status = readStringField(payload.data.status);
  const isCharging = readBooleanField(payload.data.isCharging);
  const isDischarging = readBooleanField(payload.data.isDischarging);
  const maxVoltage = readNumericField(payload.data.maxVoltage);
  const minVoltage = readNumericField(payload.data.minVoltage);
  const maxTemp = readNumericField(payload.data.maxTemp);
  const minTemp = readNumericField(payload.data.minTemp);
  const activePower = readNumericField(payload.data.activePower);

  if (
    !isoTimestamp ||
    !timeLabel ||
    soc === null ||
    !status ||
    isCharging === null ||
    isDischarging === null ||
    maxVoltage === null ||
    minVoltage === null ||
    maxTemp === null ||
    minTemp === null ||
    activePower === null
  ) {
    return null;
  }

  return {
    isoTimestamp,
    timeLabel,
    soc,
    status,
    isCharging,
    isDischarging,
    maxVoltage,
    minVoltage,
    maxTemp,
    minTemp,
    activePower,
  };
}

export function appendBatteryTelemetryPoint(
  history: BatteryTelemetryPoint[],
  nextPoint: BatteryTelemetryPoint | null,
  limit = DEFAULT_BATTERY_TELEMETRY_LIMIT,
): BatteryTelemetryPoint[] {
  if (!nextPoint) {
    return history;
  }

  const nextHistory =
    history.at(-1)?.isoTimestamp === nextPoint.isoTimestamp
      ? [...history.slice(0, -1), nextPoint]
      : [...history, nextPoint];

  return nextHistory.slice(-limit);
}
