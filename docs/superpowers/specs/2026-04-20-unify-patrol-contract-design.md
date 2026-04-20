# Unify Patrol Contract Design

Date: 2026-04-20
Owner: `frontend`
Status: Draft approved in chat, awaiting written spec review

## Goal

Remove the stale `/patrol-sessions/*` contract from the frontend runtime and align all station-patrol behavior with the contract that is already implemented by `inspection_bridge`.

After this change, the frontend will use one patrol flow:

1. Start station patrol through `POST /inspection-sessions/start` with `nodeId = "site-patrol"`.
2. Observe station-patrol progress through global SSE `GET /inspection-events`.
3. Resolve the abnormal device through the existing device inspection and work-order flow.
4. Let `/inspection/complete` be the only path that releases the patrol lock and emits `patrol_completed`.

## Why This Change

The current frontend contains two incompatible patrol models:

- The global operations page already uses the `inspection` contract.
- The 2D site page still uses a private `/patrol-sessions/*` contract and event sequence that the robot bridge does not implement.

This drift causes the 2D site page to depend on endpoints and event types that do not exist in the current backend. The first priority is to remove that mismatch rather than extending the backend to preserve the obsolete contract.

## Current Backend Truth

The current robot-side integration contract is:

- Start endpoint: `POST /inspection-sessions/start`
- Global patrol event stream: `GET /inspection-events`
- Work-order completion endpoint: `POST /work-order-completions`
- Robot completion trigger: ROS `/inspection/complete`, surfaced back to the frontend as `patrol_completed`

The current patrol event types relevant to the frontend are:

- `patrol_started`
- `patrol_anomaly_detected`
- `patrol_completed`
- `patrol_failed`

The current robot behavior is scoped to Qinghai station only:

- `siteId = "qinghai-gonghexian"`
- abnormal node id `ncu-5`
- abnormal node label `N5`

## Scope

This change is intentionally limited to the `frontend` repository.

In scope:

- Remove runtime use of `/patrol-sessions/start`
- Remove runtime use of `/patrol-sessions/stop`
- Remove runtime use of `/patrol-sessions/<requestId>/events`
- Refactor the 2D site patrol flow to consume the same `inspection` contract as the global operations page
- Keep the device-detail work-order completion flow as the release path for patrol completion
- Restrict the 2D patrol entry point to the currently supported Qinghai station

Out of scope:

- Any `neuro_bot` or ROS interface change
- A general multi-station patrol configuration system
- Renaming every frontend symbol that still contains the word `patrol`
- Introducing a dedicated patrol backend domain

## Design

### Contract Model

The frontend will treat `inspection_bridge` as the only runtime source of truth for station patrol.

Station patrol starts by calling the existing `startInspection` client with:

- `siteId = "qinghai-gonghexian"`
- `nodeId = "site-patrol"`
- `nodeLabel = "青海场站巡检"`

Station-patrol state changes are read from `subscribeGlobalInspectionEvents`, filtered to the current site and mapped to the station-patrol UI.

The frontend will stop modeling private patrol-session lifecycles that the backend does not expose. In particular, it will stop expecting:

- `target_locked`
- `patrol_announcing`
- `patrol_cancelled`
- per-request patrol SSE streams
- patrol stop/cancel requests

### Frontend State Model

`useRobotPatrol` remains the top-level hook name for now, but its internal state machine changes to match the real backend behavior.

Allowed states after the refactor:

- `idle`
- `starting`
- `dispatching`
- `anomaly`
- `error`

State transitions:

- `idle -> starting` when the user starts a supported station patrol
- `starting -> dispatching` on `patrol_started`
- `dispatching -> anomaly` on `patrol_anomaly_detected`
- `starting|dispatching|anomaly -> idle` on `patrol_completed`
- `starting|dispatching -> error` on transport failure or `patrol_failed`

The hook no longer owns stop/cancel behavior because there is no stop endpoint in the current backend contract.

### Locked Device Handling

The 2D site page currently expects a locked device card. The backend does not emit a dedicated lock event for this path, so the frontend will synthesize the locked-device payload when it receives `patrol_anomaly_detected`.

The synthesized device payload is:

- `nodeId: "ncu-5"`
- `nodeLabel: "N5"`
- `nodeType: "ncu"`
- `deviceCategory: "ncu"`

This preserves the existing UI shape while aligning it with the actual patrol event stream.

### Shared Patrol Adapter

`site-patrol.ts` already contains the correct Qinghai patrol constants and the `inspection`-based subscription pattern. The 2D patrol hook will reuse this module instead of carrying a second copy of Qinghai patrol knowledge.

This keeps:

- one start function for Qinghai station patrol
- one event-filtering path for Qinghai patrol events
- one source of anomaly node defaults

### 2D Site UI Behavior

The 2D site page will be updated as follows:

- The `开始巡检` button is enabled only for `qinghai-gonghexian`
- Unsupported sites show a disabled control and explicit explanatory copy
- The loading modal stays visible during `starting` and `dispatching`
- The lock/review card appears only after `patrol_anomaly_detected`
- The stop button is removed from the lock card because the backend has no patrol stop contract

The review card continues to route the user into the existing device-inspection and work-order flow.

### Device Detail Integration

No contract change is required in the device detail page.

The current device-detail flow already does the right thing:

1. capture evidence
2. optionally perform manual angle correction
3. submit work order
4. call work-order completion

After the work order is completed, the backend emits `patrol_completed`. The 2D page must rely on that event instead of simulating local completion.

## File-Level Impact

Primary files:

- `src/lib/robot-inspection/types.ts`
- `src/lib/robot-inspection/client.ts`
- `src/lib/robot-inspection/site-patrol.ts`
- `src/lib/robot-inspection/use-robot-patrol.ts`
- `src/app/sites/[siteId]/site-topology-2d.tsx`
- `src/components/robot-patrol-lock-card.tsx`

Secondary validation target:

- `src/app/sites/[siteId]/devices/[deviceId]/device-detail-client.tsx`

## Testing Plan

Implementation will follow a minimal TDD path centered on the contract change.

Required checks:

1. Add a regression test or narrow contract test that proves the 2D patrol flow starts through the `inspection` contract and consumes global inspection events.
2. Verify that runtime code no longer references:
   - `/patrol-sessions/start`
   - `/patrol-sessions/stop`
   - `/patrol-sessions/<requestId>/events`
3. Run `pnpm lint` in `frontend`.

Behavior expectations to validate:

- starting patrol from the 2D page uses the same backend contract as the global page
- `patrol_anomaly_detected` produces the anomaly review UI state
- `target_locked` is no longer required for the patrol path
- patrol completion depends on backend-emitted `patrol_completed`

## Risks And Tradeoffs

### Accepted tradeoff

The frontend will still contain some `patrol`-named symbols even though they now wrap `inspection` endpoints. This is acceptable for this change because the immediate goal is runtime contract correctness, not naming cleanup.

### Main risk

The 2D page may contain UI assumptions that were built around the old private patrol-session model. The refactor must preserve the operator-facing flow while swapping the underlying transport and event source.

### Mitigation

Keep the UI components and route flow intact where possible, and constrain the change to:

- start behavior
- event subscription
- state transitions
- unsupported-site gating

## Implementation Approach

Recommended approach: refactor the 2D site frontend to reuse the existing `inspection` patrol adapter and delete stale runtime client methods.

This is preferred over adding backend compatibility shims because:

- it removes drift instead of preserving it
- it matches the current backend contract documented in the robot repo
- it keeps the change isolated to the `frontend` repository

## Approval Gate

This spec is the implementation baseline for the first-priority task: unify the patrol contract by removing the stale `/patrol-sessions/*` runtime path from the frontend.
