import assert from "node:assert/strict";
import test from "node:test";

import { getRootRedirectPath } from "./root-redirect";

test("root route redirects directly to global operations", () => {
  assert.equal(getRootRedirectPath(), "/global-operations");
});
