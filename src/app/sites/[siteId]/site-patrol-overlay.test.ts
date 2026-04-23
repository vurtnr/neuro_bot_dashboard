import assert from "node:assert/strict";
import test from "node:test";

import {
  reduceSitePatrolOverlayState,
  type SitePatrolOverlayState,
} from "./site-patrol-overlay.ts";

const INITIAL_STATE: SitePatrolOverlayState = {
  siteToast: null,
  simulatedReviewNodeId: null,
  highlightedNodeId: null,
};

test("replayed patrol completion clears the anomaly toast and review target", () => {
  const started = reduceSitePatrolOverlayState(
    INITIAL_STATE,
    {
      siteId: "qinghai-gonghexian",
      event: "patrol_started",
    },
    "qinghai-gonghexian",
  );

  const anomaly = reduceSitePatrolOverlayState(
    started,
    {
      siteId: "qinghai-gonghexian",
      event: "patrol_anomaly_detected",
      nodeId: "ncu-5",
    },
    "qinghai-gonghexian",
  );

  const completed = reduceSitePatrolOverlayState(
    anomaly,
    {
      siteId: "qinghai-gonghexian",
      event: "patrol_completed",
    },
    "qinghai-gonghexian",
  );

  assert.deepEqual(completed, INITIAL_STATE);
});

test("anomaly event creates an actionable critical toast", () => {
  const next = reduceSitePatrolOverlayState(
    INITIAL_STATE,
    {
      siteId: "qinghai-gonghexian",
      event: "patrol_anomaly_detected",
      nodeId: "ncu-5",
    },
    "qinghai-gonghexian",
  );

  assert.equal(next.siteToast?.tone, "critical");
  assert.equal(next.siteToast?.actionable, true);
  assert.equal(next.simulatedReviewNodeId, "ncu-5");
});
