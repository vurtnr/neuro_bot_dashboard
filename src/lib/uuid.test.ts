import assert from "node:assert/strict";
import test from "node:test";

import { createUuid } from "./uuid.ts";

test("uses crypto.randomUUID when available", () => {
  const uuid = createUuid({
    randomUUID: () => "native-uuid",
    getRandomValues: () => {
      throw new Error("should_not_call_getRandomValues");
    },
  });

  assert.equal(uuid, "native-uuid");
});

test("falls back to crypto.getRandomValues when randomUUID is unavailable", () => {
  const uuid = createUuid({
    getRandomValues: (bytes) => {
      const seededBytes = Uint8Array.from([
        0x00, 0x11, 0x22, 0x33,
        0x44, 0x55, 0x66, 0x77,
        0x88, 0x99, 0xaa, 0xbb,
        0xcc, 0xdd, 0xee, 0xff,
      ]);
      bytes.set(seededBytes);
      return bytes;
    },
  });

  assert.equal(uuid, "00112233-4455-4677-8899-aabbccddeeff");
});

test("falls back to pseudo-random bytes when crypto is unavailable", () => {
  const originalRandom = Math.random;
  let callCount = 0;

  Math.random = () => {
    callCount += 1;
    return 0;
  };

  try {
    const uuid = createUuid({});

    assert.equal(uuid, "00000000-0000-4000-8000-000000000000");
    assert.equal(callCount, 16);
  } finally {
    Math.random = originalRandom;
  }
});
