# Planned Plant Popup B-Card Redesign

Date: 2026-04-23
Owner: `frontend`
Status: Draft approved in chat, awaiting written spec review

## Goal

Redesign the planned-plant popup on `/global-operations` to use the approved `B` direction: a cleaner modern information card with stronger hierarchy, less visual fragmentation, and a single obvious next action.

The popup should feel like a planning-state card inside the global operations dashboard, not like a compressed telemetry panel.

## Approved Direction

The approved direction is:

- visual direction: `B. 现代信息卡`
- user-approved adjustment: do **not** show `plantId`

## Problem

The current popup reads as several disconnected small cards placed inside a shared shell.

That causes three issues:

1. The eye does not know what to read first.
2. The action button feels visually detached from the information it belongs to.
3. Internal identifiers such as `plantId` compete with higher-value information like plant identity and location.

## Constraints

- The popup remains anchored to the map point.
- The existing planned-plant data model remains unchanged.
- The existing continue-planning link remains unchanged:
  `http://10.180.40.166/#/workspace/info/home?workflowId=${plantId}&tab=forward`
- Operational site popups are out of scope.
- The fixed planned plant introduced on the homepage remains in place.

## Design

### Visual Direction

Use a light glassmorphism card that stays consistent with the existing `/global-operations` dashboard, but simplify the content hierarchy.

Visual rules:

- Keep the white + pale cyan dashboard surface language.
- Use green only as a planning-state accent.
- Make the title and location the first focal point.
- Make the status badge compact and stable in the header.
- Make the primary action feel attached to the card, not floating off to the side.

### Content Hierarchy

The popup should communicate information in this order:

1. planned state
2. plant name
3. location
4. coordinate confirmation
5. continue-planning action

### Content Structure

#### Header

- eyebrow: `Planned Site` or the existing Chinese equivalent if keeping current localization tone
- title: `plantName`
- subtitle: `country · province · city`
- top-right status badge: `规划中`
- close button

#### Summary Band

One highlighted summary block below the header.

Purpose:

- give the popup a visual center
- prevent the surface from becoming a loose grid of unrelated boxes

Content:

- short planning-state description
- current approved copy can stay close to:
  `首页固定展示的规划中场站`

#### Location Block

One full-width location block for:

- `country`
- `province`
- `city`

This should read as a single geographic identity, not three independent cards.

#### Coordinate Confirmation

Use two compact metric cards:

- `经度`
- `纬度`

These remain visible because the user explicitly requested a fixed coordinate-based planned marker.

#### Action Row

- one primary action only: `继续规划`

No secondary action is needed in this redesign.

## Explicit Exclusions

- Do not display `plantId`
- Do not add simulated planning metrics
- Do not add extra chips for country / province / city if a single location block already communicates the same information
- Do not redesign the operational site popup

## Interaction Notes

- Clicking the planned plant point still opens the popup immediately.
- Closing behavior remains unchanged.
- Button destination remains unchanged.

## Success Criteria

1. The popup reads as one coherent card, not a collage of small tiles.
2. The user can identify the plant and its location at a glance.
3. The `规划中` state is obvious without dominating the whole card.
4. `plantId` is not shown anywhere in the popup.
5. The continue-planning action feels visually connected to the information above it.
6. The popup still matches the existing global operations dashboard language.

## Files Likely To Change

- `frontend/src/components/global-operations/planned-plant-popup.tsx`
- `frontend/src/app/globals.css`
- optional small popup width/height adjustment in:
  `frontend/src/components/global-operations/global-map-scene.tsx`
