import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlannedPlantRedirectUrl,
  createPlannedPlantFromPayload,
  getPlannedPlantRegionLabel,
  mergePinnedPlannedPlants,
  PINNED_PLANNED_PLANTS,
  toPlannedPlantFeatureCollection,
  upsertPlannedPlant,
  type PlannedPlant,
} from "./planned-plant";
import { sanitizeStoredPlannedPlants } from "./planned-plant-storage";

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

test("merges the pinned planned plant into the homepage list", () => {
  const merged = mergePinnedPlannedPlants([
    {
      plantId: "plant-42",
      lng: 100.42,
      lat: 36.17,
      name: "Qinghai/gonghexian",
      country: "中国",
      province: "青海",
      city: "共和县",
    },
  ]);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], PINNED_PLANNED_PLANTS[0]);
  assert.equal(merged[1]?.plantId, "plant-42");
});

test("adds the planned tag label into the feature collection", () => {
  const collection = toPlannedPlantFeatureCollection(PINNED_PLANNED_PLANTS);

  assert.equal(collection.features[0]?.properties.tagLabel, "规划中");
});
