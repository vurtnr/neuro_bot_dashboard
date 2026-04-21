# Unify Patrol Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the stale `/patrol-sessions/*` runtime path from the frontend and make the 2D site patrol flow reuse the existing `inspection` contract.

**Architecture:** Keep `inspection_bridge` as the only patrol backend contract. Refactor the 2D site patrol hook into a thin adapter over `startInspection` plus global `inspection-events`, and preserve the existing device-detail work-order close path as the only patrol completion signal.

**Tech Stack:** Next.js 16, React 19, TypeScript, ESLint 9, Node built-in assertions for narrow contract verification, `rg` for runtime contract checks.

---

### Task 1: Add a Narrow Patrol Contract Test Surface

**Files:**
- Create: `src/lib/robot-inspection/patrol-contract.ts`
- Create: `src/lib/robot-inspection/patrol-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLockedDeviceFromPatrolEvent,
  getSupportedPatrolSiteMessage,
  isSupportedPatrolSite,
  reducePatrolState,
  type PatrolContractState,
} from "./patrol-contract";
import type { RobotInspectionEvent } from "./types";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm exec tsc src/lib/robot-inspection/patrol-contract.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/patrol-contract-test`

Expected: FAIL because `src/lib/robot-inspection/patrol-contract.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { PatrolLockedDevice, RobotInspectionEvent } from "./types";

export type PatrolRuntimeStatus =
  | "idle"
  | "starting"
  | "dispatching"
  | "anomaly"
  | "error";

export type PatrolContractState = {
  status: PatrolRuntimeStatus;
  requestId: string | null;
  lockedDevice: PatrolLockedDevice | null;
  message: string;
  error: string;
};

export function isSupportedPatrolSite(siteId: string) {
  return siteId === "qinghai-gonghexian";
}

export function getSupportedPatrolSiteMessage(siteId: string) {
  return isSupportedPatrolSite(siteId)
    ? ""
    : `当前机器人巡检链路仅接入青海场站，暂不支持 ${siteId} 发起巡检。`;
}

export function buildLockedDeviceFromPatrolEvent(
  event: Pick<RobotInspectionEvent, "nodeId" | "nodeLabel">,
): PatrolLockedDevice {
  return {
    nodeId: event.nodeId ?? "ncu-5",
    nodeLabel: event.nodeLabel ?? "N5",
    nodeType: "ncu",
    deviceCategory: "ncu",
  };
}

export function reducePatrolState(
  current: PatrolContractState,
  event: RobotInspectionEvent,
): PatrolContractState {
  if (event.event === "patrol_started") {
    return {
      ...current,
      status: "dispatching",
      requestId: event.requestId,
      message: event.message ?? "机器人已接收巡检请求，正在进入自动巡检状态。",
      error: "",
    };
  }

  if (event.event === "patrol_anomaly_detected") {
    return {
      status: "anomaly",
      requestId: event.requestId,
      lockedDevice: buildLockedDeviceFromPatrolEvent(event),
      message:
        event.message ?? "发生巡检事件：检测到异常设备，点击查看详细信息。",
      error: "",
    };
  }

  if (event.event === "patrol_failed") {
    return {
      status: "error",
      requestId: null,
      lockedDevice: null,
      message: "",
      error: event.message ?? "机器人巡检失败，请稍后重试。",
    };
  }

  if (event.event === "patrol_completed") {
    return {
      status: "idle",
      requestId: null,
      lockedDevice: null,
      message: "",
      error: "",
    };
  }

  return current;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
- `cd frontend && pnpm exec tsc src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/patrol-contract-test`
- `cd /tmp/patrol-contract-test && node src/lib/robot-inspection/patrol-contract.test.js`

Expected: PASS with all tests green.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts
git commit -m "test: add patrol contract reducer coverage"
```

### Task 2: Remove the Stale Patrol Runtime Client

**Files:**
- Modify: `src/lib/robot-inspection/types.ts`
- Modify: `src/lib/robot-inspection/client.ts`
- Modify: `src/lib/robot-inspection/site-patrol.ts`

- [ ] **Step 1: Write the failing test**

Reuse `src/lib/robot-inspection/patrol-contract.test.ts` by importing event types from `types.ts` after removing stale patrol-only event shapes. The failing condition is type-check failure if `RobotInspectionEvent` and the reducer no longer agree.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm exec tsc src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/patrol-contract-test`

Expected: FAIL once the outdated `RobotPatrolEvent`-specific imports and types are removed but call sites still reference them.

- [ ] **Step 3: Write minimal implementation**

Update:

- `types.ts` to remove `StartPatrolPayload`, `StartPatrolResponse`, `StopPatrolPayload`, `StopPatrolResponse`, and the stale `RobotPatrolEventType` variants that the backend does not emit
- `client.ts` to delete `startPatrol`, `stopPatrol`, and `subscribePatrolEvents`
- `site-patrol.ts` to remain the shared Qinghai patrol adapter over `startInspection` and `subscribeGlobalInspectionEvents`

- [ ] **Step 4: Run test to verify it passes**

Run:
- `cd frontend && pnpm exec tsc src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/patrol-contract-test`
- `cd /tmp/patrol-contract-test && node src/lib/robot-inspection/patrol-contract.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/lib/robot-inspection/types.ts src/lib/robot-inspection/client.ts src/lib/robot-inspection/site-patrol.ts
git commit -m "refactor: remove stale patrol runtime client"
```

### Task 3: Refactor the 2D Patrol Hook to Use Inspection Events

**Files:**
- Modify: `src/lib/robot-inspection/use-robot-patrol.ts`
- Modify: `src/lib/robot-inspection/patrol-session.ts`
- Modify: `src/lib/robot-inspection/patrol-contract.ts`

- [ ] **Step 1: Write the failing test**

Extend `src/lib/robot-inspection/patrol-contract.test.ts` with a case asserting that anomaly state persists a synthetic locked device and that completion clears it.

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
- `cd frontend && pnpm exec tsc src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/patrol-contract-test`
- `cd /tmp/patrol-contract-test && node src/lib/robot-inspection/patrol-contract.test.js`

Expected: FAIL until the reducer and hook state model match the new persisted-lock behavior.

- [ ] **Step 3: Write minimal implementation**

Refactor `use-robot-patrol.ts` to:

- import `startQinghaiSitePatrol` and `subscribeQinghaiSitePatrolEvents`
- drop all private patrol-session SSE open/close logic for `/patrol-sessions/*`
- reduce hook state to `idle | starting | dispatching | anomaly | error`
- synthesize and persist the locked device on `patrol_anomaly_detected`
- clear persisted lock on `patrol_completed`
- expose `startPatrol` and `clearPatrolState`, but remove runtime stop behavior

Adjust `patrol-session.ts` only if needed to keep persisted anomaly locks compatible with the new state model.

- [ ] **Step 4: Run test to verify it passes**

Run:
- `cd frontend && pnpm exec tsc src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/patrol-contract-test`
- `cd /tmp/patrol-contract-test && node src/lib/robot-inspection/patrol-contract.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/lib/robot-inspection/use-robot-patrol.ts src/lib/robot-inspection/patrol-session.ts src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts
git commit -m "refactor: align 2d patrol hook with inspection events"
```

### Task 4: Update the 2D Site UI and Patrol Lock Card

**Files:**
- Modify: `src/app/sites/[siteId]/site-topology-2d.tsx`
- Modify: `src/components/robot-patrol-lock-card.tsx`

- [ ] **Step 1: Write the failing test**

Use a static contract check for stale runtime paths plus a state-driven assertion in `patrol-contract.test.ts`. The test failure is the continued presence of stale client references in the 2D page.

- [ ] **Step 2: Run test to verify it fails**

Run:
- `cd /Users/jiaoyumin/workspace/robot_dashboard && rg -n "/patrol-sessions/start|/patrol-sessions/stop|/patrol-sessions/.*/events|startPatrol\\(|stopPatrol\\(" frontend/src`

Expected: FAIL with matches in runtime code before the UI refactor is complete.

- [ ] **Step 3: Write minimal implementation**

Update `site-topology-2d.tsx` to:

- disable patrol start for unsupported sites using `isSupportedPatrolSite`
- surface the unsupported-site explanatory copy
- remove `stopPatrol` usage
- treat the lock card as an anomaly review entry point

Update `robot-patrol-lock-card.tsx` to:

- remove the stop button
- remove stop-pending props
- keep only the connect action and anomaly information

- [ ] **Step 4: Run test to verify it passes**

Run:
- `cd /Users/jiaoyumin/workspace/robot_dashboard && rg -n "/patrol-sessions/start|/patrol-sessions/stop|/patrol-sessions/.*/events" frontend/src`

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/app/sites/[siteId]/site-topology-2d.tsx src/components/robot-patrol-lock-card.tsx
git commit -m "feat: align 2d patrol ui with inspection contract"
```

### Task 5: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the narrow patrol contract test**

Run:
- `cd frontend && pnpm exec tsc src/lib/robot-inspection/patrol-contract.ts src/lib/robot-inspection/patrol-contract.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/patrol-contract-test`
- `cd /tmp/patrol-contract-test && node src/lib/robot-inspection/patrol-contract.test.js`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `cd frontend && pnpm lint`

Expected: exit code `0`.

- [ ] **Step 3: Run stale-contract search**

Run: `cd /Users/jiaoyumin/workspace/robot_dashboard && rg -n "/patrol-sessions/start|/patrol-sessions/stop|/patrol-sessions/.*/events" frontend/src`

Expected: no matches.

- [ ] **Step 4: Commit final verification-ready state**

```bash
cd frontend
git add src/lib/robot-inspection src/components/robot-patrol-lock-card.tsx src/app/sites/[siteId]/site-topology-2d.tsx
git commit -m "fix: unify frontend patrol contract"
```
