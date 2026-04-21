# Planned Plant Anchored Popup Redesign

Date: 2026-04-20
Owner: `frontend`
Status: Draft approved in chat, awaiting written spec review

## Goal

Fix the delayed popup experience when clicking a green planned-plant tag on `/global-operations`, while keeping the popup anchored to the clicked map point.

The redesign must preserve the "map-attached" interaction model but remove the dead time between click and popup appearance. It must also upgrade the planned-plant popup visual design so it feels like a planning task card instead of a generic site tooltip.

## Problem

The current planned-plant popup waits for map-driven popup layout calculation before rendering. That creates a visible pause after the user clicks a green tag.

This feels broken even when the popup eventually appears, because the user does not get instant confirmation that their click succeeded.

The current popup styling also reads as a trimmed-down copy of the existing site popup instead of a dedicated planning-state surface.

## Constraints

- Existing blue/yellow/gray operational site points must remain unchanged.
- Existing operational site popup layout and behavior must remain unchanged.
- Planned plants must stay on the anchored-popup interaction model, not move to a fixed side card.
- The redesign is scoped to planned-plant popup interaction and styling only.
- The existing `continue planning` destination stays unchanged:
  `http://10.180.40.166/#/workspace/info/home?workflowId=${plantId}&tab=forward`

## Design

### Interaction Fix

The planned-plant popup should open immediately on click.

Implementation behavior:

1. Clicking a green planned-plant tag immediately sets the selected planned plant.
2. The UI creates an initial popup position directly from the clicked feature coordinates, without waiting for a secondary layout pass.
3. On the next animation frame, the popup position may be refined to stay inside the map container and choose top/bottom placement.
4. If refinement changes the final placement, the popup should shift slightly, not "appear late."

This means the user sees an anchored popup instantly, then at most a subtle micro-adjustment.

### Visual Direction

The popup should look like a planning task card anchored to a map point, not like an operational telemetry card.

Visual rules:

- Keep the existing white/blue glassy dashboard language so the popup still belongs to `/global-operations`.
- Use green as the state accent, not as the full background.
- Make the status `规划中` visually prominent in the top-right area.
- Simplify hierarchy so the eye lands first on:
  1. plant name
  2. location
  3. planning state
  4. continue-planning action

### Content Structure

The redesigned popup should contain:

#### Header

- eyebrow: `规划中新场站`
- title: `plantName`
- subtitle: `country / province / city`
- top-right badge: `规划中`
- close button

#### Context band

- one short line indicating source, for example:
  `来自实时建站推送`

#### Metrics grid

Use four compact simulated metrics:

- `装机容量`
- `预计实时功率`
- `环境温度`
- `辐照强度`

These are intentionally lighter than the operational site popup. They should feel like "planning context" rather than live control-room telemetry.

#### Action row

- primary button: `继续规划`

No secondary action is required in this redesign.

## Non-Goals

- No redesign of existing operational site popups
- No side drawer or right-hand planning panel
- No change to WebSocket ingestion
- No change to planned-plant persistence model
- No new planning workflow steps beyond the existing external link

## Success Criteria

1. Clicking a green planned-plant tag gives immediate visual feedback with no noticeable dead time.
2. The popup remains anchored near the clicked map point.
3. Any post-open layout correction is subtle and does not feel like delayed rendering.
4. Existing operational site popup behavior remains unchanged.
5. The redesigned planned-plant popup clearly communicates:
   - plant identity
   - location
   - planning state
   - continue-planning action
6. The popup feels visually distinct from the operational site popup while still matching the page's design system.

## Files Likely To Change

- `frontend/src/components/global-operations/global-map-scene.tsx`
- `frontend/src/components/global-operations/planned-plant-popup.tsx`
- optional supporting popup layout helper file if the immediate-open logic is extracted
