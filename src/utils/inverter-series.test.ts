import assert from "node:assert/strict";
import test from "node:test";

import { buildOrderedTimeLabels } from "./inverter-series";

test("builds ordered unique time labels as strings", () => {
  const orderedTimeLabels = buildOrderedTimeLabels([
    {
      points: [
        { timeLabel: "10:30", sortKey: "2026-04-20 10:30:00" },
        { timeLabel: "09:30", sortKey: "2026-04-20 09:30:00" },
      ],
    },
    {
      points: [
        { timeLabel: "10:30", sortKey: "2026-04-20 10:30:00" },
        { timeLabel: "11:30", sortKey: "2026-04-20 11:30:00" },
      ],
    },
  ]);

  assert.deepEqual(orderedTimeLabels, ["09:30", "10:30", "11:30"]);
});
