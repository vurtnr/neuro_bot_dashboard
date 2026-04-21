import assert from "node:assert/strict";
import test from "node:test";

import type { RobotInspectionEvent } from "./types";
import {
  buildLockedDeviceFromPatrolEvent,
  getSupportedPatrolSiteMessage,
  isSupportedPatrolSite,
  reducePatrolState,
  type PatrolContractState,
} from "./patrol-contract";

const BASE_EVENT: RobotInspectionEvent = {
  requestId: "req-1",
  event: "patrol_started",
  siteId: "qinghai-gonghexian",
  nodeId: "ncu-5",
  nodeLabel: "N5",
  message: "started",
};

test("reduces inspection patrol events into 2d patrol state", () => {
  const initial: PatrolContractState = {
    status: "starting",
    requestId: "req-1",
    lockedDevice: null,
    message: "",
    error: "",
  };

  const dispatching = reducePatrolState(initial, BASE_EVENT);
  assert.equal(dispatching.status, "dispatching");

  const anomaly = reducePatrolState(dispatching, {
    ...BASE_EVENT,
    event: "patrol_anomaly_detected",
    message: "anomaly",
  });
  assert.equal(anomaly.status, "anomaly");
  assert.equal(anomaly.lockedDevice?.nodeId, "ncu-5");

  const completed = reducePatrolState(anomaly, {
    ...BASE_EVENT,
    event: "patrol_completed",
    message: "done",
  });
  assert.equal(completed.status, "idle");
  assert.equal(completed.lockedDevice, null);
});

test("only qinghai is currently supported for station patrol", () => {
  assert.equal(isSupportedPatrolSite("qinghai-gonghexian"), true);
  assert.equal(isSupportedPatrolSite("alpha"), false);
  assert.match(getSupportedPatrolSiteMessage("alpha"), /青海场站/);
});

test("builds a fallback locked device from anomaly event data", () => {
  const device = buildLockedDeviceFromPatrolEvent({
    ...BASE_EVENT,
    event: "patrol_anomaly_detected",
  });

  assert.deepEqual(device, {
    nodeId: "ncu-5",
    nodeLabel: "N5",
    nodeType: "ncu",
    deviceCategory: "ncu",
  });
});

test("anomaly state is persistable and completion clears the lock", () => {
  const anomaly = reducePatrolState(
    {
      status: "dispatching",
      requestId: "req-1",
      lockedDevice: null,
      message: "",
      error: "",
    },
    {
      requestId: "req-1",
      event: "patrol_anomaly_detected",
      siteId: "qinghai-gonghexian",
      nodeId: "ncu-5",
      nodeLabel: "N5",
    },
  );

  assert.equal(anomaly.lockedDevice?.nodeId, "ncu-5");

  const completed = reducePatrolState(anomaly, {
    requestId: "req-1",
    event: "patrol_completed",
    siteId: "qinghai-gonghexian",
  });

  assert.equal(completed.lockedDevice, null);
});
