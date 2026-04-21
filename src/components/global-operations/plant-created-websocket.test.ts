import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlantCreatedConnectionLabel,
  getPlantCreatedConnectionTone,
  getPlantCreatedRetryDelay,
} from "./plant-created-websocket";

test("maps plant-created websocket states to visible labels", () => {
  assert.equal(getPlantCreatedConnectionLabel("disabled"), "Plant Feed 未配置");
  assert.equal(getPlantCreatedConnectionLabel("connecting"), "Plant Feed 连接中");
  assert.equal(getPlantCreatedConnectionLabel("connected"), "Plant Feed 已连接");
  assert.equal(getPlantCreatedConnectionLabel("reconnecting"), "Plant Feed 重连中");
  assert.equal(getPlantCreatedConnectionLabel("error"), "Plant Feed 异常");
});

test("maps plant-created websocket states to badge tones", () => {
  assert.equal(getPlantCreatedConnectionTone("disabled"), "muted");
  assert.equal(getPlantCreatedConnectionTone("connecting"), "info");
  assert.equal(getPlantCreatedConnectionTone("connected"), "success");
  assert.equal(getPlantCreatedConnectionTone("reconnecting"), "warning");
  assert.equal(getPlantCreatedConnectionTone("error"), "critical");
});

test("uses capped exponential backoff for reconnect delay", () => {
  assert.equal(getPlantCreatedRetryDelay(0), 1000);
  assert.equal(getPlantCreatedRetryDelay(1), 2000);
  assert.equal(getPlantCreatedRetryDelay(2), 4000);
  assert.equal(getPlantCreatedRetryDelay(3), 8000);
  assert.equal(getPlantCreatedRetryDelay(4), 10000);
  assert.equal(getPlantCreatedRetryDelay(6), 10000);
});
