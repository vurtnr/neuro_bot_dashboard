import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PlannedPlantPopup } from "./planned-plant-popup";

const plannedPlant = {
  plantId: "303342051150270464",
  lng: 116.397583,
  lat: 39.907806,
  name: "集中式光伏上网电站",
  country: "中国",
  province: "河北省",
  city: "石家市",
};

test("renders the approved B-card content without exposing plantId as visible copy", () => {
  const html = renderToStaticMarkup(
    <PlannedPlantPopup plannedPlant={plannedPlant} onClose={() => {}} />,
  );

  assert.ok(html.includes("Planned Site"));
  assert.ok(html.includes("集中式光伏上网电站"));
  assert.ok(html.includes("中国 · 河北省 · 石家市"));
  assert.ok(html.includes("规划中场站"));
  assert.ok(html.includes("站点位置"));
  assert.ok(html.includes("中国 / 河北省 / 石家市"));
  assert.ok(html.includes("经度"));
  assert.ok(html.includes("纬度"));
  assert.ok(html.includes("规划中"));
  assert.ok(html.includes("继续规划"));
  assert.ok(html.includes("planned-plant-popup-card"));
  assert.ok(html.includes("planned-plant-popup-status"));
  assert.ok(html.includes("planned-plant-popup-summary"));
  assert.ok(html.includes("planned-plant-popup-location"));
  assert.ok(html.includes("planned-plant-popup-coordinate-grid"));
  assert.ok(html.includes("planned-plant-popup-actions"));
  assert.ok(html.includes("workflowId=303342051150270464"));
  assert.equal(html.includes(">plantId<"), false);
  assert.equal(html.includes(">303342051150270464<"), false);
});
