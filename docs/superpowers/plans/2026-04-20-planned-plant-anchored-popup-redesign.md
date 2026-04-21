# Planned Plant Anchored Popup Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make planned-plant popups appear immediately when a green tag is clicked, while redesigning the anchored popup into a clearer planning task card.

**Architecture:** Keep the planned-plant popup anchored to the clicked map point, but split layout math into a dedicated helper so the popup can open immediately from click coordinates and then refine its placement on the next frame. Keep the existing operational site popup path unchanged, and redesign only the planned-plant popup's content hierarchy, metrics, and visual treatment.

**Tech Stack:** Next.js 16, React 19, TypeScript, MapLibre GL JS, `node:test`, `tsc`, ESLint 9.

---

## File Structure

- Create: `frontend/src/components/global-operations/planned-plant-popup-layout.ts`
  Responsibility: anchored popup layout math shared by immediate-open and post-open refinement.
- Create: `frontend/src/components/global-operations/planned-plant-popup-layout.test.ts`
  Responsibility: narrow tests for placement, clamping, and edge handling.
- Modify: `frontend/src/components/global-operations/planned-plant.ts`
  Responsibility: update planned-plant metrics to match the redesigned popup content.
- Modify: `frontend/src/components/global-operations/planned-plant.test.ts`
  Responsibility: verify the redesigned metric set.
- Modify: `frontend/src/components/global-operations/planned-plant-popup.tsx`
  Responsibility: rebuild the planned-plant popup into a clearer planning task card.
- Modify: `frontend/src/components/global-operations/global-map-scene.tsx`
  Responsibility: open planned-plant popups immediately from click coordinates and then refine placement without touching the existing operational site popup flow.

Note: `pnpm build` currently fails on an unrelated Highcharts typing issue in `frontend/src/app/sites/[siteId]/site-topology-flow.tsx`. This plan uses targeted tests, compile checks, and `pnpm lint` as verification gates for this redesign.

### Task 1: Add A Dedicated Anchored Popup Layout Helper

**Files:**
- Create: `frontend/src/components/global-operations/planned-plant-popup-layout.ts`
- Create: `frontend/src/components/global-operations/planned-plant-popup-layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { resolveAnchoredPopupLayout } from "./planned-plant-popup-layout";

test("uses bottom placement when the anchor is too close to the top edge", () => {
  const layout = resolveAnchoredPopupLayout({
    anchorX: 420,
    anchorY: 40,
    containerWidth: 1280,
    containerHeight: 820,
    panelWidth: 560,
    panelHeight: 236,
  });

  assert.equal(layout.placement, "bottom");
});

test("clamps popup left position inside the map container", () => {
  const layout = resolveAnchoredPopupLayout({
    anchorX: 16,
    anchorY: 300,
    containerWidth: 1280,
    containerHeight: 820,
    panelWidth: 560,
    panelHeight: 236,
  });

  assert.equal(layout.left, 24);
});

test("prefers top placement when there is enough space above the anchor", () => {
  const layout = resolveAnchoredPopupLayout({
    anchorX: 640,
    anchorY: 420,
    containerWidth: 1280,
    containerHeight: 820,
    panelWidth: 560,
    panelHeight: 236,
  });

  assert.equal(layout.placement, "top");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant-popup-layout.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-popup-layout-test
```

Expected: FAIL because `src/components/global-operations/planned-plant-popup-layout.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type PopupPlacement = "top" | "bottom";

export type PopupLayout = {
  left: number;
  top: number;
  placement: PopupPlacement;
};

type PopupLayoutInput = {
  anchorX: number;
  anchorY: number;
  containerWidth: number;
  containerHeight: number;
  panelWidth: number;
  panelHeight: number;
  safeTop?: number;
  safeBottom?: number;
  safeLeft?: number;
  safeRight?: number;
};

export function resolveAnchoredPopupLayout({
  anchorX,
  anchorY,
  containerWidth,
  containerHeight,
  panelWidth,
  panelHeight,
  safeTop = 96,
  safeBottom = 84,
  safeLeft = 24,
  safeRight = 24,
}: PopupLayoutInput): PopupLayout {
  const maxLeft = Math.max(safeLeft, containerWidth - safeRight - panelWidth);
  const left = Math.min(
    Math.max(anchorX - panelWidth / 2, safeLeft),
    maxLeft,
  );

  const canPlaceBottom =
    anchorY < panelHeight + safeTop &&
    containerHeight - anchorY > panelHeight + safeBottom;

  return {
    left,
    top: anchorY,
    placement: canPlaceBottom ? "bottom" : "top",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant-popup-layout.ts src/components/global-operations/planned-plant-popup-layout.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-popup-layout-test
node /tmp/planned-plant-popup-layout-test/planned-plant-popup-layout.test.js
```

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/planned-plant-popup-layout.ts src/components/global-operations/planned-plant-popup-layout.test.ts
git commit -m "test: add planned plant popup layout helper"
```

### Task 2: Update Planned Plant Metrics For The Redesigned Card

**Files:**
- Modify: `frontend/src/components/global-operations/planned-plant.ts`
- Modify: `frontend/src/components/global-operations/planned-plant.test.ts`

- [ ] **Step 1: Write the failing test**

Append this test to `frontend/src/components/global-operations/planned-plant.test.ts`:

```ts
import { buildPlannedPlantMetrics } from "./planned-plant";

test("builds the redesigned metric set for the planning popup", () => {
  const metrics = buildPlannedPlantMetrics({
    plantId: "plant-42",
    lng: 100.42,
    lat: 36.17,
    name: "Qinghai/gonghexian",
    country: "中国",
    province: "青海",
    city: "共和县",
  });

  assert.deepEqual(
    metrics.map((metric) => metric.label),
    ["装机容量", "预计实时功率", "环境温度", "辐照强度"],
  );
  assert.equal(metrics.length, 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: FAIL because the current metrics still include `经纬度` and `海拔`.

- [ ] **Step 3: Write minimal implementation**

Replace `buildPlannedPlantMetrics()` in `frontend/src/components/global-operations/planned-plant.ts` with:

```ts
export function buildPlannedPlantMetrics(
  plannedPlant: PlannedPlant,
): PlannedPlantMetric[] {
  const seed = deriveSeed(plannedPlant);
  const capacity = 28 + (seed % 15);
  const projectedPower = (capacity * (0.63 + ((seed % 18) / 100))).toFixed(1);
  const temperature = (16 + ((seed % 35) / 10)).toFixed(1);
  const irradiance = 760 + (seed % 120);

  return [
    {
      label: "装机容量",
      value: `${capacity} MW`,
    },
    {
      label: "预计实时功率",
      value: `${projectedPower} MW`,
    },
    {
      label: "环境温度",
      value: `${temperature} °C`,
    },
    {
      label: "辐照强度",
      value: `${irradiance} W/m²`,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: PASS with 6 passing tests.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant.test.ts
git commit -m "feat: update planned plant metrics for redesign"
```

### Task 3: Redesign The Planned Plant Popup Card

**Files:**
- Modify: `frontend/src/components/global-operations/planned-plant-popup.tsx`

- [ ] **Step 1: Write the failing test**

Run this static content check first:

```bash
cd /Users/jiaoyumin/workspace/robot_dashboard
rg -n "来自实时建站推送|预计实时功率|Planning Queue" frontend/src/components/global-operations/planned-plant-popup.tsx
```

Expected: FAIL with no matches, because the current popup does not yet include the redesigned source band or metric language.

- [ ] **Step 2: Run test to verify it fails**

Run the command above exactly.

Expected: no matches.

- [ ] **Step 3: Write minimal implementation**

Replace the current popup body in `frontend/src/components/global-operations/planned-plant-popup.tsx` with a planning-task-card structure:

```tsx
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
      <div className="rounded-[20px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(248,252,255,0.96))] px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-emerald-700/80 uppercase">
          Planning Queue
        </p>
        <p className="mt-2 text-sm font-medium text-slate-700">
          来自实时建站推送
        </p>
      </div>
    </section>

    <section className="global-site-popup-secondary">
      <div className="global-site-popup-meta">
        {metrics.map((metric) => (
          <MetricItem
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
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
```

Keep the popup within the current visual language: white/blue glass body, green badge, green source band, single primary CTA.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/jiaoyumin/workspace/robot_dashboard
rg -n "来自实时建站推送|预计实时功率|Planning Queue" frontend/src/components/global-operations/planned-plant-popup.tsx
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-popup.tsx --jsx react-jsx --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node,react --outDir /tmp/planned-plant-popup-test
```

Expected: content matches found, compile passes.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/planned-plant-popup.tsx src/components/global-operations/planned-plant.ts
git commit -m "feat: redesign planned plant popup card"
```

### Task 4: Open Planned Plant Popups Immediately On Click

**Files:**
- Modify: `frontend/src/components/global-operations/global-map-scene.tsx`
- Modify: `frontend/src/components/global-operations/planned-plant-popup-layout.ts`

- [ ] **Step 1: Write the failing test**

Run this static check:

```bash
cd /Users/jiaoyumin/workspace/robot_dashboard
rg -n "setPopupLayout\\(resolveAnchoredPopupLayout|selectedPlannedPlant" frontend/src/components/global-operations/global-map-scene.tsx
```

Expected: FAIL because the click handler does not yet synchronously set popup layout from click coordinates.

- [ ] **Step 2: Run test to verify it fails**

Run the command above exactly.

Expected: no match for `setPopupLayout(resolveAnchoredPopupLayout`.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/components/global-operations/global-map-scene.tsx`:

1. Import the helper:

```ts
import {
  resolveAnchoredPopupLayout,
  type PopupLayout,
} from "@/components/global-operations/planned-plant-popup-layout";
```

2. In `updatePopupLayout()`, replace inline clamping math with:

```ts
setPopupLayout(
  resolveAnchoredPopupLayout({
    anchorX: projected.x,
    anchorY: projected.y,
    containerWidth: container.clientWidth,
    containerHeight: container.clientHeight,
    panelWidth: PANEL_WIDTH,
    panelHeight: PANEL_HEIGHT,
  }),
);
```

3. In `handlePlannedPlantClick()`, set immediate layout before selection:

```ts
setPopupLayout(
  resolveAnchoredPopupLayout({
    anchorX: event.point.x,
    anchorY: event.point.y,
    containerWidth: map.getContainer().clientWidth,
    containerHeight: map.getContainer().clientHeight,
    panelWidth: PANEL_WIDTH,
    panelHeight: PANEL_HEIGHT,
  }),
);
setSelectedSiteId(null);
setSelectedPlannedPlantId(plantId);
```

4. Expand the requestAnimationFrame sync effect dependencies from:

```ts
}, [anomalySite, selectedSite, viewMode]);
```

to:

```ts
}, [anomalySite, selectedPlannedPlant, selectedSite, viewMode]);
```

This keeps the popup visible immediately, then refines it one frame later using projected map coordinates.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/jiaoyumin/workspace/robot_dashboard
rg -n "setPopupLayout\\(resolveAnchoredPopupLayout|selectedPlannedPlant" frontend/src/components/global-operations/global-map-scene.tsx
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant-popup-layout.ts src/components/global-operations/planned-plant-popup-layout.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-popup-layout-test
node /tmp/planned-plant-popup-layout-test/planned-plant-popup-layout.test.js
pnpm lint
```

Expected: static matches present, layout tests pass, lint passes.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/global-map-scene.tsx src/components/global-operations/planned-plant-popup-layout.ts src/components/global-operations/planned-plant-popup-layout.test.ts src/components/global-operations/planned-plant-popup.tsx src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant.test.ts
git commit -m "fix: make planned plant popup open instantly"
```

### Task 5: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run planned-plant domain tests**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-storage.ts src/components/global-operations/planned-plant.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-test
node /tmp/planned-plant-test/planned-plant.test.js
```

Expected: PASS.

- [ ] **Step 2: Run popup layout tests**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant-popup-layout.ts src/components/global-operations/planned-plant-popup-layout.test.ts --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node --outDir /tmp/planned-plant-popup-layout-test
node /tmp/planned-plant-popup-layout-test/planned-plant-popup-layout.test.js
```

Expected: PASS.

- [ ] **Step 3: Run popup compile check**

Run:

```bash
cd frontend
pnpm exec tsc src/components/global-operations/planned-plant.ts src/components/global-operations/planned-plant-popup.tsx --jsx react-jsx --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom --types node,react --outDir /tmp/planned-plant-popup-test
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
cd frontend
pnpm lint
```

Expected: exit code `0`.

- [ ] **Step 5: Record known unrelated blocker**

Run:

```bash
cd frontend
pnpm build
```

Expected: build may still fail on the unrelated `site-topology-flow.tsx` Highcharts typing issue. If it fails there and nowhere in the redesigned popup files, record that in the final handoff rather than treating it as a blocker for this redesign.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/components/global-operations
git commit -m "feat: redesign planned plant anchored popup"
```
