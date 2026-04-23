import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AbnormalWorkOrderCard } from "./abnormal-work-order-card";

test("renders abnormal work order escalation copy and action", () => {
  const html = renderToStaticMarkup(
    <AbnormalWorkOrderCard status="idle" onRequestSupport={() => {}} />,
  );

  assert.ok(html.includes("异常状态工单"));
  assert.ok(html.includes("机器人与 AI 无法确认根因"));
  assert.ok(html.includes("天合光能运维部门"));
  assert.ok(html.includes("请求技术支持"));
});

test("renders pending state without allowing duplicate request copy", () => {
  const html = renderToStaticMarkup(
    <AbnormalWorkOrderCard status="sending" onRequestSupport={() => {}} />,
  );

  assert.ok(html.includes("正在通知机器人"));
  assert.ok(html.includes("disabled"));
});

test("renders submitted technical support state", () => {
  const html = renderToStaticMarkup(
    <AbnormalWorkOrderCard status="submitted" onRequestSupport={() => {}} />,
  );

  assert.ok(html.includes("已提交寻求技术支持"));
  assert.ok(html.includes("天合光能运维部门已接收"));
  assert.ok(html.includes("disabled"));
});
