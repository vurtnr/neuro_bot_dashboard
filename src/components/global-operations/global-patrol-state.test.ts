import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveGlobalPatrolStateFromSession,
  isGlobalInspectionBusy,
} from "./global-patrol-state.ts";

test("restores anomaly state from a persisted patrol session", () => {
  const state = deriveGlobalPatrolStateFromSession("qinghai-gonghexian", {
    requestId: "req-1",
    siteId: "qinghai-gonghexian",
    status: "locked",
    lockedDevice: {
      nodeId: "ncu-5",
      nodeLabel: "N5",
      nodeType: "ncu",
      deviceCategory: "ncu",
    },
  });

  assert.deepEqual(state, {
    patrolStage: "anomaly",
    inspectionSiteId: "qinghai-gonghexian",
    anomalySiteId: "qinghai-gonghexian",
  });
});

test("keeps patrol button enabled when there is no active session", () => {
  const state = deriveGlobalPatrolStateFromSession(
    "qinghai-gonghexian",
    null,
  );

  assert.deepEqual(state, {
    patrolStage: "idle",
    inspectionSiteId: null,
    anomalySiteId: null,
  });
  assert.equal(isGlobalInspectionBusy(state.patrolStage), false);
});

test("treats anomaly patrol stage as busy so start button stays disabled", () => {
  assert.equal(isGlobalInspectionBusy("starting"), true);
  assert.equal(isGlobalInspectionBusy("dispatching"), true);
  assert.equal(isGlobalInspectionBusy("anomaly"), true);
  assert.equal(isGlobalInspectionBusy("idle"), false);
});
