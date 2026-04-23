import assert from "node:assert/strict";
import test from "node:test";

import { getGlobalSummary, globalSitePoints } from "./data.ts";

test("includes planned site count in the global summary", () => {
  const summary = getGlobalSummary(globalSitePoints, 2);

  assert.equal(summary.plannedSiteCount, 2);
});

test("defaults planned site count to zero when none are provided", () => {
  const summary = getGlobalSummary(globalSitePoints);

  assert.equal(summary.plannedSiteCount, 0);
});
