# Global Operations Planned Plant Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WebSocket-driven planned-plant overlay to `/global-operations` that creates green map points with their own popup and local browser persistence, while keeping existing site points unchanged.

**Architecture:** Keep the existing `GlobalSitePoint` model and existing site map source untouched. Add a separate planned-plant frontend model, `localStorage` persistence, WebSocket payload adapter, and dedicated MapLibre source/layers plus a dedicated popup component for planned plants.

**Tech Stack:** Next.js 16, React 19, TypeScript, MapLibre GL JS, browser `localStorage`, `node:test`, `tsc`, ESLint 9.

---

## File Structure

- Create: `frontend/src/components/global-operations/planned-plant.ts`
  Responsibility: planned-plant domain types, payload normalization, simulated popup metrics, and direct planning URL construction.
- Create: `frontend/src/components/global-operations/planned-plant-storage.ts`
  Responsibility: browser persistence keyed by `plantId`.
- Create: `frontend/src/components/global-operations/planned-plant-popup.tsx`
  Responsibility: popup template for WebSocket-created planned plants only.
- Create: `frontend/src/components/global-operations/planned-plant.test.ts`
  Responsibility: narrow behavior tests for payload normalization, persistence-safe upsert behavior, and planning URL generation.
- Modify: `frontend/src/components/global-operations/global-operations-client.tsx`
  Responsibility: hold planned-plant state, hydrate from storage, upsert from WebSocket messages, and pass planned plants into the map scene.
- Modify: `frontend/src/components/global-operations/global-map-scene.tsx`
  Responsibility: add a second source/layer family for planned plants, wire click handling for that family, and render the planned-plant popup while leaving the existing site popup alone.

### Task 1: Add Planned Plant Domain Model And Tests

**Files:**
- Create: `frontend/src/components/global-operations/planned-plant.ts`
- Create: `frontend/src/components/global-operations/planned-plant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlannedPlantRedirectUrl,
  createPlannedPlantFromPayload,
  upsertPlannedPlant,
  type PlannedPlant,
} from "./planned-plant";

test("creates a planned plant from websocket payload", () => {
  const plannedPlant = createPlannedPlantFromPayload({
    plantId: "plant-42",
    longitude: 100.42,
    latitude: 36.17,
    plantName: "Qinghai/gonghexian",
    country: "中国",
    province: "青海",
    city: "共和县",
  });

  assert.deepEqual(plannedPlant, {
    plantId: "plant-42",
    lng: 100.42,
    lat: 36.17,
    name: "Qinghai/gonghexian",
    country: "中国",
    province: "青海",
    city: "共和县",
  });
});

test("upserts planned plants by plantId", () => {
  const existing: PlannedPlant[] = [
    {
      plantId: "plant-42",
      lng: 100,
      lat: 36,
      name: "Old",
      country: "中国",
      province: "青海",
      city: "共和县",
    },
  ];

  const updated = upsertPlannedPlant(existing, {
    plantId: "plant-42",
    lng: 100.42,
    lat: 36.17,
    name: "New",
    country: "中国",
    province: "青海",
    city: "共和县",
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.name, "New");
  assert.equal(updated[0]?.lng, 100.42);
});

test("builds the continue-planning url from plantId", () => {
  assert.equal(
    buildPlannedPlantRedirectUrl("plant-42"),
    "http://10.180.40.166/#/workspace/info/home?workflowId=plant-42&tab=forward",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
```

Expected: FAIL because `src/components/global-operations/planned-plant.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type PlannedPlantPayload = {
  plantId?: string;
  longitude?: number;
  latitude?: number;
  plantName?: string;
  country?: string;
  province?: string;
  city?: string;
};

export type PlannedPlant = {
  plantId: string;
  lng: number;
  lat: number;
  name: string;
  country: string;
  province: string;
  city: string;
};

export function createPlannedPlantFromPayload(
  payload: PlannedPlantPayload,
): PlannedPlant | null {
  if (
    typeof payload.plantId !== "string" ||
    typeof payload.longitude !== "number" ||
    typeof payload.latitude !== "number" ||
    typeof payload.plantName !== "string" ||
    typeof payload.country !== "string" ||
    typeof payload.province !== "string" ||
    typeof payload.city !== "string"
  ) {
    return null;
  }

  return {
    plantId: payload.plantId,
    lng: payload.longitude,
    lat: payload.latitude,
    name: payload.plantName,
    country: payload.country,
    province: payload.province,
    city: payload.city,
  };
}

export function upsertPlannedPlant(
  current: PlannedPlant[],
  incoming: PlannedPlant,
): PlannedPlant[] {
  const next = current.filter((item) => item.plantId !== incoming.plantId);
  return [...next, incoming];
}

export function buildPlannedPlantRedirectUrl(plantId: string) {
  return `http://10.180.40.166/#/workspace/info/home?workflowId=${plantId}&tab=forward`;
}

export function getPlannedPlantRegionLabel(plannedPlant: PlannedPlant) {
  return `${plannedPlant.country}  ${plannedPlant.province} · ${plannedPlant.city}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant.test.ts
git commit -m "test: add planned plant domain coverage"
```

### Task 2: Add Browser Persistence For Planned Plants

**Files:**
- Create: `frontend/src/components/global-operations/planned-plant-storage.ts`
- Modify: `frontend/src/components/global-operations/planned-plant.test.ts`

- [ ] **Step 1: Write the failing test**

Append this test to `frontend/src/components/global-operations/planned-plant.test.ts`:

```ts
import {
  sanitizeStoredPlannedPlants,
} from "./planned-plant-storage";

test("sanitizes stored planned plants and removes invalid entries", () => {
  const result = sanitizeStoredPlannedPlants([
    {
      plantId: "plant-42",
      lng: 100.42,
      lat: 36.17,
      name: "Qinghai/gonghexian",
      country: "中国",
      province: "青海",
      city: "共和县",
    },
    {
      plantId: 42,
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.plantId, "plant-42");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant-storage.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
```

Expected: FAIL because `planned-plant-storage.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { PlannedPlant } from "./planned-plant";

const STORAGE_KEY = "robot-dashboard:planned-plants";

function isPlannedPlant(value: unknown): value is PlannedPlant {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.plantId === "string" &&
    typeof record.lng === "number" &&
    typeof record.lat === "number" &&
    typeof record.name === "string" &&
    typeof record.country === "string" &&
    typeof record.province === "string" &&
    typeof record.city === "string"
  );
}

export function sanitizeStoredPlannedPlants(value: unknown): PlannedPlant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlannedPlant);
}

export function readPlannedPlants(): PlannedPlant[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    return sanitizeStoredPlannedPlants(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function writePlannedPlants(plants: PlannedPlant[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-storage.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/planned-plant-storage.ts src/components/global-operations/planned-plant.test.ts
git commit -m "feat: persist planned plants in local storage"
```

### Task 3: Feed Planned Plants Into Global Operations State

**Files:**
- Modify: `frontend/src/components/global-operations/global-operations-client.tsx`
- Modify: `frontend/src/components/global-operations/planned-plant.ts`
- Modify: `frontend/src/components/global-operations/planned-plant.test.ts`

- [ ] **Step 1: Write the failing test**

Append this test to `frontend/src/components/global-operations/planned-plant.test.ts`:

```ts
import { getPlannedPlantRegionLabel } from "./planned-plant";

test("formats the planned plant location line for the popup header", () => {
  const label = getPlannedPlantRegionLabel({
    plantId: "plant-42",
    lng: 100.42,
    lat: 36.17,
    name: "Qinghai/gonghexian",
    country: "中国",
    province: "青海",
    city: "共和县",
  });

  assert.equal(label, "中国  青海 · 共和县");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: FAIL until `getPlannedPlantRegionLabel()` is present and returns the expected format.

- [ ] **Step 3: Write minimal implementation**

Update `frontend/src/components/global-operations/global-operations-client.tsx` so it:

- imports `PlannedPlant`, `createPlannedPlantFromPayload`, and `upsertPlannedPlant`
- imports `readPlannedPlants` and `writePlannedPlants`
- initializes planned-plant state from `readPlannedPlants()`
- on every WebSocket `message`, parses JSON and attempts:

```ts
const plannedPlant = createPlannedPlantFromPayload(payload);
if (!plannedPlant) {
  return;
}

setPlannedPlants((current) => {
  const next = upsertPlannedPlant(current, plannedPlant);
  writePlannedPlants(next);
  return next;
});
```

- passes `plannedPlants` into `GlobalMapScene` as a separate prop

Do not merge planned plants into `pointsWithSimulationState`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-storage.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: PASS with 5 passing tests.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/global-operations-client.tsx src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-storage.ts src/components/global-operations/planned-plant.test.ts
git commit -m "feat: hydrate planned plants from websocket and storage"
```

### Task 4: Add Dedicated Planned Plant Popup Component

**Files:**
- Create: `frontend/src/components/global-operations/planned-plant-popup.tsx`

- [ ] **Step 1: Write the failing test**

Use the existing type-level coverage path by importing `buildPlannedPlantRedirectUrl()` and `getPlannedPlantRegionLabel()` from the popup component dependencies. The failing condition is that the popup component file does not exist and `GlobalMapScene` cannot import it yet.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant-popup.tsx --jsx react-jsx --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node,react --outDir /tmp/planned-plant-popup-test
```

Expected: FAIL because the component file does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/global-operations/planned-plant-popup.tsx` with a dedicated popup that:

- shows `plannedPlant.name`
- shows `country / province / city`
- renders a fixed top-right status badge `规划中`
- shows simulated metrics using `lng/lat`-stable derived values
- opens the planning URL in a new tab

Use this component shape:

```tsx
"use client";

import {
  buildPlannedPlantRedirectUrl,
  getPlannedPlantRegionLabel,
  type PlannedPlant,
} from "./planned-plant";

type PlannedPlantPopupProps = {
  plannedPlant: PlannedPlant;
  onClose: () => void;
};

export function PlannedPlantPopup({
  plannedPlant,
  onClose,
}: PlannedPlantPopupProps) {
  const planningUrl = buildPlannedPlantRedirectUrl(plannedPlant.plantId);

  return (
    <div className="global-site-popup-card">
      <div className="global-site-popup-header">
        <div className="min-w-0">
          <p className="global-site-popup-eyebrow">规划中新场站</p>
          <h3 className="global-site-popup-title">{plannedPlant.name}</h3>
          <p className="global-site-popup-subtitle">
            {getPlannedPlantRegionLabel(plannedPlant)}
          </p>
        </div>
        <div className="global-site-popup-header-actions">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            规划中
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭规划场站浮窗"
            className="global-site-popup-close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="global-site-popup-content">
        <section className="global-site-popup-primary">
          <div className="global-site-popup-footer">
            <div className="global-site-popup-inline-meta">
              <p className="global-site-popup-footer-line">
                国家：{plannedPlant.country}
              </p>
              <p className="global-site-popup-footer-line">
                省份：{plannedPlant.province}
              </p>
              <p className="global-site-popup-footer-line">
                城市：{plannedPlant.city}
              </p>
            </div>
          </div>
        </section>

        <section className="global-site-popup-secondary">
          <div className="global-site-popup-meta">
            <div className="global-site-popup-metric">
              <span className="global-site-popup-metric-label">经纬度</span>
              <strong className="global-site-popup-metric-value">
                {plannedPlant.lng.toFixed(3)}, {plannedPlant.lat.toFixed(3)}
              </strong>
            </div>
            <div className="global-site-popup-metric">
              <span className="global-site-popup-metric-label">装机容量</span>
              <strong className="global-site-popup-metric-value">34 MW</strong>
            </div>
            <div className="global-site-popup-metric">
              <span className="global-site-popup-metric-label">实时功率</span>
              <strong className="global-site-popup-metric-value">25.5 MW</strong>
            </div>
          </div>
          <div className="global-site-popup-secondary-actions">
            <a
              href={planningUrl}
              target="_blank"
              rel="noreferrer"
              className="global-site-popup-primary-action"
            >
              继续规划
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-popup.tsx --jsx react-jsx --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node,react --outDir /tmp/planned-plant-popup-test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/planned-plant-popup.tsx src/components/global-operations/planned-plant.ts
git commit -m "feat: add planned plant popup component"
```

### Task 5: Render Planned Plants As A Separate Map Overlay

**Files:**
- Modify: `frontend/src/components/global-operations/global-map-scene.tsx`
- Modify: `frontend/src/components/global-operations/planned-plant.ts`

- [ ] **Step 1: Write the failing test**

Use a static runtime search as the red step to enforce the new layer IDs and the split popup path.

```bash
cd /Users/jiaoyumin/workspace/robot_dashboard
rg -n "planned-plants|PlannedPlantPopup|selectedPlannedPlant" frontend/src/components/global-operations/global-map-scene.tsx
```

Expected: FAIL with no matches before implementation.

- [ ] **Step 2: Run test to verify it fails**

Run the command above exactly.

Expected: no matches.

- [ ] **Step 3: Write minimal implementation**

Modify `frontend/src/components/global-operations/global-map-scene.tsx` to:

- extend props with:

```ts
import type { PlannedPlant } from "./planned-plant";

type GlobalMapSceneProps = {
  points: GlobalSitePoint[];
  plannedPlants?: PlannedPlant[];
  anomalySiteId?: string | null;
  inspectionBusy?: boolean;
  onStartInspection?: (site: GlobalSitePoint) => void;
  onOpenAnomalyReview?: (site: GlobalSitePoint) => void;
  onOpenSiteDetail?: (site: GlobalSitePoint) => void;
};
```

- add a dedicated planned-plant GeoJSON builder:

```ts
function toPlannedPlantFeatureCollection(plants: PlannedPlant[]) {
  return {
    type: "FeatureCollection" as const,
    features: plants.map((plant) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [plant.lng, plant.lat] as [number, number],
      },
      properties: {
        plantId: plant.plantId,
        name: plant.name,
      },
    })),
  };
}
```

- add a second source and green layers, for example:

```ts
const PLANNED_SOURCE_ID = "planned-plants";
const PLANNED_HALO_LAYER_ID = "planned-plants-halo";
const PLANNED_CORE_LAYER_ID = "planned-plants-core";
```

- add `selectedPlannedPlantId` state and derive `selectedPlannedPlant`
- bind click handling for planned-plant layers before falling back to clearing the old selected site
- render `PlannedPlantPopup` when a planned plant is selected
- keep the existing `SitePopupCard` rendering path untouched for old points

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/jiaoyumin/workspace/robot_dashboard
rg -n "planned-plants|PlannedPlantPopup|selectedPlannedPlant" frontend/src/components/global-operations/global-map-scene.tsx
```

Expected: matches found for the new planned-plant source/layer and popup path.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/global-map-scene.tsx src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-popup.tsx
git commit -m "feat: render planned plant overlay on global map"
```

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the domain tests**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-storage.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: PASS.

- [ ] **Step 2: Run popup compile check**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-popup.tsx --jsx react-jsx --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node,react --outDir /tmp/planned-plant-popup-test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
cd frontend
pnpm lint
```

Expected: exit code `0`.

- [ ] **Step 4: Verify old patrol contract work remains untouched**

Run:

```bash
cd /Users/jiaoyumin/workspace/robot_dashboard
rg -n "/patrol-sessions/start|/patrol-sessions/stop|/patrol-sessions/.*/events" frontend/src
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations
git commit -m "feat: add planned plant websocket overlay"
```
