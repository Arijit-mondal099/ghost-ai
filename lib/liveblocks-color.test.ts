import { describe, expect, test } from "bun:test";

import { CURSOR_COLORS, cursorColorForUserId } from "@/lib/cursor-color";

describe("cursorColorForUserId", () => {
  test("empty id returns first palette slot", () => {
    expect(cursorColorForUserId("")).toBe(CURSOR_COLORS[0]);
  });

  test("deterministic and always in palette", () => {
    expect(cursorColorForUserId("alice")).toBe(cursorColorForUserId("alice"));
    expect(CURSOR_COLORS.includes(cursorColorForUserId("alice"))).toBe(true);
    expect(CURSOR_COLORS.includes(cursorColorForUserId("bob"))).toBe(true);
    expect(CURSOR_COLORS.includes(cursorColorForUserId("user-123"))).toBe(true);
  });
});
