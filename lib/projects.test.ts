import { describe, expect, test } from "bun:test";

import { slugify } from "@/lib/projects";

describe("slugify", () => {
  test("lowercases and trims", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  test("collapses separators and strips edge dashes", () => {
    expect(slugify("Auth Service Redesign")).toBe("auth-service-redesign");
    expect(slugify("a---b__c  d")).toBe("a-b-c-d");
    expect(slugify("---hello---")).toBe("hello");
  });

  test("drops non-alphanumerics and handles empty", () => {
    expect(slugify("Event Pipeline!")).toBe("event-pipeline");
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});
