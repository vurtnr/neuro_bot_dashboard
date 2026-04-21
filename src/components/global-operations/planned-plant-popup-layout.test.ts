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
