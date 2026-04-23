# Planned Plant Popup B-Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/global-operations` planned-plant popup into the approved B-card layout, removing visible `plantId` content while keeping the existing continue-planning link intact.

**Architecture:** Keep the anchored popup interaction unchanged and confine the redesign to the planned-plant popup surface. First lock the render contract with a narrow server-rendered component test, then replace the popup markup and extract dedicated planned-popup style hooks so the new card can evolve without disturbing the operational site popup styles.

**Tech Stack:** Next.js 16, React 19, TypeScript, React DOM Server, ESLint 9, `node:test`.

---

## File Structure

- Create: `frontend/src/components/global-operations/planned-plant-popup.test.tsx`
  Responsibility: render-contract test for the approved popup content and class hooks.
- Modify: `frontend/src/components/global-operations/planned-plant-popup.tsx`
  Responsibility: replace the fragmented tile layout with the approved B-card information hierarchy.
- Modify: `frontend/src/app/globals.css`
  Responsibility: add dedicated planned-popup styles without regressing the operational site popup.

## Task 1: Lock The Popup Content Contract And Rebuild The JSX

**Files:**
- Create: `frontend/src/components/global-operations/planned-plant-popup.test.tsx`
- Modify: `frontend/src/components/global-operations/planned-plant-popup.tsx`

- [ ] **Step 1: Write the failing render test**

Create `frontend/src/components/global-operations/planned-plant-popup.test.tsx` with:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PlannedPlantPopup } from "./planned-plant-popup";

const plannedPlant = {
  plantId: "303342051150270464",
  lng: 116.397583,
  lat: 39.907806,
  name: "集中式光伏上网电站",
  country: "Antigua and Barbuda",
  province: "Barbuda",
  city: "Codrington",
};

test("renders the approved B-card content without exposing plantId as visible copy", () => {
  const html = renderToStaticMarkup(
    <PlannedPlantPopup plannedPlant={plannedPlant} onClose={() => {}} />,
  );

  assert.ok(html.includes("Planned Site"));
  assert.ok(html.includes("集中式光伏上网电站"));
  assert.ok(html.includes("Antigua and Barbuda · Barbuda · Codrington"));
  assert.ok(html.includes("首页固定展示的规划中场站"));
  assert.ok(html.includes("站点位置"));
  assert.ok(html.includes("Antigua and Barbuda / Barbuda / Codrington"));
  assert.ok(html.includes("经度"));
  assert.ok(html.includes("纬度"));
  assert.ok(html.includes("规划中"));
  assert.ok(html.includes("继续规划"));
  assert.ok(html.includes("workflowId=303342051150270464"));
  assert.equal(html.includes(">plantId<"), false);
  assert.equal(html.includes(">303342051150270464<"), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc \
  src/components/global-operations/planned-plant.ts \
  src/components/global-operations/planned-plant-popup.tsx \
  src/components/global-operations/planned-plant-popup.test.tsx \
  --jsx react-jsx \
  --module nodenext \
  --moduleResolution nodenext \
  --target es2022 \
  --lib es2022,dom \
  --types node,react,react-dom \
  --outDir /tmp/planned-plant-popup-test
node /tmp/planned-plant-popup-test/planned-plant-popup.test.js
```

Expected: FAIL because the current popup still renders a visible `plantId` card, does not render the `站点位置` block, and does not split coordinates into `经度` / `纬度`.

- [ ] **Step 3: Replace the popup JSX with the approved B-card structure**

Replace `frontend/src/components/global-operations/planned-plant-popup.tsx` with:

```tsx
"use client";

import { buildPlannedPlantRedirectUrl, type PlannedPlant } from "./planned-plant";

type PlannedPlantPopupProps = {
  plannedPlant: PlannedPlant;
  onClose: () => void;
};

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function CoordinateCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="global-site-popup-metric">
      <span className="global-site-popup-metric-label">{label}</span>
      <strong className="global-site-popup-metric-value">{value}</strong>
    </div>
  );
}

export function PlannedPlantPopup({
  plannedPlant,
  onClose,
}: PlannedPlantPopupProps) {
  const planningUrl = buildPlannedPlantRedirectUrl(plannedPlant.plantId);
  const regionLine = `${plannedPlant.country} · ${plannedPlant.province} · ${plannedPlant.city}`;
  const locationBlock = `${plannedPlant.country} / ${plannedPlant.province} / ${plannedPlant.city}`;

  return (
    <div className="global-site-popup-card">
      <div className="global-site-popup-header">
        <div className="min-w-0">
          <p className="global-site-popup-eyebrow">Planned Site</p>
          <h3 className="global-site-popup-title">{plannedPlant.name}</h3>
          <p className="global-site-popup-subtitle">{regionLine}</p>
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
          <div className="rounded-[24px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(240,249,255,0.92))] px-4 py-4">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-emerald-700/80 uppercase">
              Planning Summary
            </p>
            <p className="mt-3 text-[15px] font-medium leading-7 text-slate-700">
              首页固定展示的规划中场站
            </p>
          </div>

          <div className="rounded-[22px] border border-slate-100/90 bg-white/78 px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
              站点位置
            </p>
            <p className="mt-3 text-base font-semibold leading-7 text-slate-800">
              {locationBlock}
            </p>
          </div>
        </section>

        <section className="global-site-popup-secondary">
          <div className="grid grid-cols-2 gap-3">
            <CoordinateCard
              label="经度"
              value={formatCoordinate(plannedPlant.lng)}
            />
            <CoordinateCard
              label="纬度"
              value={formatCoordinate(plannedPlant.lat)}
            />
          </div>
          <div className="mt-4">
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

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd frontend
pnpm exec tsc \
  src/components/global-operations/planned-plant.ts \
  src/components/global-operations/planned-plant-popup.tsx \
  src/components/global-operations/planned-plant-popup.test.tsx \
  --jsx react-jsx \
  --module nodenext \
  --moduleResolution nodenext \
  --target es2022 \
  --lib es2022,dom \
  --types node,react,react-dom \
  --outDir /tmp/planned-plant-popup-test
node /tmp/planned-plant-popup-test/planned-plant-popup.test.js
```

Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/global-operations/planned-plant-popup.tsx src/components/global-operations/planned-plant-popup.test.tsx
git commit -m "feat: simplify planned plant popup content"
```

## Task 2: Add Dedicated Planned-Popup Style Hooks And Final Card Styling

**Files:**
- Modify: `frontend/src/components/global-operations/planned-plant-popup.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: `frontend/src/components/global-operations/planned-plant-popup.test.tsx`

- [ ] **Step 1: Extend the render test to require stable planned-popup style hooks**

Append these assertions inside the existing test in `frontend/src/components/global-operations/planned-plant-popup.test.tsx`:

```tsx
  assert.ok(html.includes("planned-plant-popup-card"));
  assert.ok(html.includes("planned-plant-popup-status"));
  assert.ok(html.includes("planned-plant-popup-summary"));
  assert.ok(html.includes("planned-plant-popup-location"));
  assert.ok(html.includes("planned-plant-popup-coordinate-grid"));
  assert.ok(html.includes("planned-plant-popup-actions"));
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd frontend
pnpm exec tsc \
  src/components/global-operations/planned-plant.ts \
  src/components/global-operations/planned-plant-popup.tsx \
  src/components/global-operations/planned-plant-popup.test.tsx \
  --jsx react-jsx \
  --module nodenext \
  --moduleResolution nodenext \
  --target es2022 \
  --lib es2022,dom \
  --types node,react,react-dom \
  --outDir /tmp/planned-plant-popup-test
node /tmp/planned-plant-popup-test/planned-plant-popup.test.js
```

Expected: FAIL because the popup markup does not yet expose dedicated planned-popup class hooks.

- [ ] **Step 3: Add semantic class names in the component and final styles in `globals.css`**

Update the component structure in `frontend/src/components/global-operations/planned-plant-popup.tsx`:

```tsx
    <div className="global-site-popup-card planned-plant-popup-card">
      <div className="global-site-popup-header">
        <div className="min-w-0">
          <p className="global-site-popup-eyebrow">Planned Site</p>
          <h3 className="global-site-popup-title">{plannedPlant.name}</h3>
          <p className="global-site-popup-subtitle">{regionLine}</p>
        </div>

        <div className="global-site-popup-header-actions">
          <span className="planned-plant-popup-status">规划中</span>
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

      <div className="global-site-popup-content planned-plant-popup-content">
        <section className="global-site-popup-primary">
          <div className="planned-plant-popup-summary">
            <p className="planned-plant-popup-summary-label">Planning Summary</p>
            <p className="planned-plant-popup-summary-copy">
              首页固定展示的规划中场站
            </p>
          </div>

          <div className="planned-plant-popup-location">
            <p className="planned-plant-popup-location-label">站点位置</p>
            <p className="planned-plant-popup-location-value">{locationBlock}</p>
          </div>
        </section>

        <section className="global-site-popup-secondary">
          <div className="planned-plant-popup-coordinate-grid">
            <CoordinateCard
              label="经度"
              value={formatCoordinate(plannedPlant.lng)}
            />
            <CoordinateCard
              label="纬度"
              value={formatCoordinate(plannedPlant.lat)}
            />
          </div>
          <div className="planned-plant-popup-actions">
            <a
              href={planningUrl}
              target="_blank"
              rel="noreferrer"
              className="global-site-popup-primary-action planned-plant-popup-primary-action"
            >
              继续规划
            </a>
          </div>
        </section>
      </div>
    </div>
```

Append these rules to `frontend/src/app/globals.css` after the existing popup styles:

```css
.planned-plant-popup-card {
  background:
    radial-gradient(circle at 82% 12%, rgba(16, 185, 129, 0.16), transparent 24%),
    radial-gradient(circle at 16% 100%, rgba(14, 165, 233, 0.12), transparent 22%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.98), rgba(240, 253, 250, 0.92));
  border-color: rgba(167, 243, 208, 0.86);
}

.planned-plant-popup-content {
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 16px;
}

.planned-plant-popup-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 8px 13px;
  background: rgba(220, 252, 231, 0.92);
  color: #15803d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  box-shadow: inset 0 0 0 1px rgba(134, 239, 172, 0.72);
}

.planned-plant-popup-summary {
  border-radius: 24px;
  padding: 16px;
  border: 1px solid rgba(187, 247, 208, 0.92);
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.92), rgba(240, 249, 255, 0.92));
}

.planned-plant-popup-summary-label,
.planned-plant-popup-location-label {
  margin: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.planned-plant-popup-summary-label {
  color: rgba(5, 150, 105, 0.82);
}

.planned-plant-popup-summary-copy {
  margin: 10px 0 0;
  font-size: 15px;
  line-height: 1.65;
  font-weight: 600;
  color: #334155;
}

.planned-plant-popup-location {
  border-radius: 22px;
  padding: 16px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08);
}

.planned-plant-popup-location-label {
  color: rgba(100, 116, 139, 0.82);
}

.planned-plant-popup-location-value {
  margin: 10px 0 0;
  font-size: 16px;
  line-height: 1.7;
  font-weight: 700;
  color: #1e293b;
}

.planned-plant-popup-coordinate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.planned-plant-popup-actions {
  margin-top: 16px;
}

.planned-plant-popup-primary-action {
  width: 100%;
  height: 42px;
  background: linear-gradient(135deg, #059669, #34d399);
  box-shadow: 0 18px 30px rgba(16, 185, 129, 0.24);
}

@media (max-width: 640px) {
  .planned-plant-popup-content {
    grid-template-columns: 1fr;
  }

  .planned-plant-popup-coordinate-grid {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 4: Run tests and project verification**

Run:

```bash
cd frontend
pnpm exec tsc \
  src/components/global-operations/planned-plant.ts \
  src/components/global-operations/planned-plant-popup.tsx \
  src/components/global-operations/planned-plant-popup.test.tsx \
  --jsx react-jsx \
  --module nodenext \
  --moduleResolution nodenext \
  --target es2022 \
  --lib es2022,dom \
  --types node,react,react-dom \
  --outDir /tmp/planned-plant-popup-test
node /tmp/planned-plant-popup-test/planned-plant-popup.test.js
pnpm lint
pnpm build
```

Expected:

- component test PASS with 1 passing test
- `pnpm lint` exits 0
- `pnpm build` exits 0

- [ ] **Step 5: Manual browser verification and commit**

Run:

```bash
cd frontend
pnpm dev
```

Then verify on `http://localhost:3000/global-operations`:

- the planned-plant popup opens from the map point as before
- the eyebrow reads `Planned Site`
- the subtitle reads `Antigua and Barbuda · Barbuda · Codrington`
- the card shows one `站点位置` block instead of separate country / region / town tiles
- only `经度` and `纬度` appear as coordinate cards
- no visible `plantId` text appears anywhere in the popup
- the `继续规划` button spans the action row and opens the existing planning URL

Commit:

```bash
cd frontend
git add src/components/global-operations/planned-plant-popup.tsx src/components/global-operations/planned-plant-popup.test.tsx src/app/globals.css
git commit -m "feat: redesign planned plant popup card"
```

## Self-Review

- Spec coverage: this plan covers the approved B-card hierarchy, removes visible `plantId`, keeps the existing planning URL, and leaves operational site popups untouched.
- Placeholder scan: no `TODO`, `TBD`, or vague “handle later” steps remain.
- Type consistency: the same `PlannedPlantPopup` props, coordinate formatting helper, and CSS class names are used consistently across both tasks.
