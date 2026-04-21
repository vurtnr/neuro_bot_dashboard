import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlantCreatedWebSocketUrl,
  getRobotBaseUrl,
  hasRobotBaseUrl,
} from "./config";

function withRuntimeConfigWindow<T>(
  runtimeConfig: Record<string, string> | undefined,
  run: () => T,
) {
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: runtimeConfig
      ? {
          __ROBOT_DASHBOARD_RUNTIME_CONFIG__: runtimeConfig,
        }
      : undefined,
    configurable: true,
    writable: true,
  });

  try {
    return run();
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  }
}

test("prefers runtime-config robot base url on the client", () => {
  const previous = process.env.NEXT_PUBLIC_ROBOT_BASE_URL;
  process.env.NEXT_PUBLIC_ROBOT_BASE_URL = "https://build-time.example.com";

  try {
    const result = withRuntimeConfigWindow(
      {
        NEXT_PUBLIC_ROBOT_BASE_URL: "https://runtime.example.com",
      },
      () => getRobotBaseUrl(),
    );

    assert.equal(result, "https://runtime.example.com");
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_ROBOT_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_ROBOT_BASE_URL = previous;
    }
  }
});

test("returns an empty robot base url when runtime config is absent in this test runtime", () => {
  const previous = process.env.NEXT_PUBLIC_ROBOT_BASE_URL;
  delete process.env.NEXT_PUBLIC_ROBOT_BASE_URL;

  try {
    const result = withRuntimeConfigWindow(undefined, () => getRobotBaseUrl());
    assert.equal(result, "");
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_ROBOT_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_ROBOT_BASE_URL = previous;
    }
  }
});

test("reports robot base url availability from runtime config", () => {
  const previous = process.env.NEXT_PUBLIC_ROBOT_BASE_URL;
  delete process.env.NEXT_PUBLIC_ROBOT_BASE_URL;

  try {
    const unavailable = withRuntimeConfigWindow(undefined, () => hasRobotBaseUrl());
    assert.equal(unavailable, false);

    const available = withRuntimeConfigWindow(
      {
        NEXT_PUBLIC_ROBOT_BASE_URL: "https://runtime.example.com",
      },
      () => hasRobotBaseUrl(),
    );
    assert.equal(available, true);
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_ROBOT_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_ROBOT_BASE_URL = previous;
    }
  }
});

test("returns empty string when plant-created websocket url is not configured", () => {
  const previous = process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL;
  delete process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL;

  try {
    assert.equal(getPlantCreatedWebSocketUrl(), "");
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL;
    } else {
      process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL = previous;
    }
  }
});

test("returns the configured plant-created websocket url", () => {
  const previous = process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL;
  process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL =
    "wss://example.com/ws/plant-created";

  try {
    const result = withRuntimeConfigWindow(
      {
        NEXT_PUBLIC_PLANT_CREATED_WS_URL: "wss://runtime.example.com/ws/plant-created",
      },
      () => getPlantCreatedWebSocketUrl(),
    );
    assert.equal(result, "wss://runtime.example.com/ws/plant-created");
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL;
    } else {
      process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL = previous;
    }
  }
});

test("ignores invalid non-websocket plant-created urls", () => {
  const previous = process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL;
  process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL =
    "https://example.com/ws/plant-created";

  try {
    assert.equal(getPlantCreatedWebSocketUrl(), "");
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL;
    } else {
      process.env.NEXT_PUBLIC_PLANT_CREATED_WS_URL = previous;
    }
  }
});
