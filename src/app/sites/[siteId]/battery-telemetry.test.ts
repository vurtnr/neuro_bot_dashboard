import assert from "node:assert/strict";
import test from "node:test";

import {
  appendBatteryTelemetryPoint,
  parseBatteryTelemetryMessage,
} from "./battery-telemetry.ts";

test("parses battery websocket payload into a chart point", () => {
  const point = parseBatteryTelemetryMessage(
    JSON.stringify({
      type: "battery:update",
      data: {
        timestamp: "2026-04-21T07:05:26.585Z",
        soc: 95.42,
        isCharging: false,
        isDischarging: true,
        status: "discharging",
        maxVoltage: 3.37,
        minVoltage: 3.3,
        maxTemp: 27.5,
        minTemp: 25.6,
        activePower: 2502.85,
        dailyCharge: 0,
        dailyDischarge: 0,
        totalCharge: 100000,
        totalDischarge: 150007,
        meterPower: 2503,
      },
    }),
  );

  assert.deepEqual(point, {
    isoTimestamp: "2026-04-21T07:05:26.585Z",
    timeLabel: "07:05:26",
    soc: 95.42,
    status: "discharging",
    isCharging: false,
    isDischarging: true,
    maxVoltage: 3.37,
    minVoltage: 3.3,
    maxTemp: 27.5,
    minTemp: 25.6,
    activePower: 2502.85,
  });
});

test("ignores unsupported websocket messages", () => {
  const point = parseBatteryTelemetryMessage(
    JSON.stringify({
      type: "battery:noop",
      data: {
        timestamp: "2026-04-21T07:05:26.585Z",
      },
    }),
  );

  assert.equal(point, null);
});

test("keeps a bounded rolling battery history and replaces duplicate timestamps", () => {
  const first = parseBatteryTelemetryMessage(
    JSON.stringify({
      type: "battery:update",
      data: {
        timestamp: "2026-04-21T07:05:26.585Z",
        soc: 95,
        isCharging: false,
        isDischarging: true,
        status: "discharging",
        maxVoltage: 3.37,
        minVoltage: 3.3,
        maxTemp: 27.5,
        minTemp: 25.6,
        activePower: 2502.85,
      },
    }),
  );
  const duplicate = parseBatteryTelemetryMessage(
    JSON.stringify({
      type: "battery:update",
      data: {
        timestamp: "2026-04-21T07:05:26.585Z",
        soc: 96,
        isCharging: false,
        isDischarging: true,
        status: "discharging",
        maxVoltage: 3.38,
        minVoltage: 3.31,
        maxTemp: 27.6,
        minTemp: 25.7,
        activePower: 2600,
      },
    }),
  );
  const second = parseBatteryTelemetryMessage(
    JSON.stringify({
      type: "battery:update",
      data: {
        timestamp: "2026-04-21T07:05:31.585Z",
        soc: 94,
        isCharging: false,
        isDischarging: true,
        status: "discharging",
        maxVoltage: 3.36,
        minVoltage: 3.29,
        maxTemp: 27.4,
        minTemp: 25.5,
        activePower: 2400,
      },
    }),
  );

  const rolling = appendBatteryTelemetryPoint(
    appendBatteryTelemetryPoint(
      appendBatteryTelemetryPoint([], first, 2),
      duplicate,
      2,
    ),
    second,
    2,
  );

  assert.equal(rolling.length, 2);
  assert.equal(rolling[0]?.soc, 96);
  assert.equal(rolling[1]?.isoTimestamp, "2026-04-21T07:05:31.585Z");
});
