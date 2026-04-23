import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import RobotInspectionModal from "./robot-inspection-modal";

test("renders refusal actions without exposing generic failure copy", () => {
  const html = renderToStaticMarkup(
    <RobotInspectionModal
      dialogState={{
        open: true,
        phase: "permission_denied",
        message: "用户已明确拒绝本次设备数据获取请求。",
        detail: "你可以结束本次复核，或重新请求机器人进行语音确认。",
        requestId: "req-1",
      }}
      onClose={() => {}}
      onRetryPermission={() => {}}
    />,
  );

  assert.ok(html.includes("语音授权被拒绝"));
  assert.ok(html.includes("结束本次复核"));
  assert.ok(html.includes("重新请求语音确认"));
  assert.equal(html.includes("识别失败"), false);
});
