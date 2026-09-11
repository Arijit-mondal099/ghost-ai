// ---------------------------------------------------------------------------
// Minimal ambient types for `bun:test`.
//
// Bun is the package manager here but `bun-types` is not installed, so `tsc`
// cannot resolve the `bun:test` import in repo tests. This covers only the
// API surface repo tests actually use. If `bun-types` is ever added, delete
// this file to avoid duplicate declarations.
// ---------------------------------------------------------------------------

declare module "bun:test" {
  export type TestFn = (name: string, fn: () => void | Promise<void>, timeoutMs?: number) => void;

  export interface TestScope extends TestFn {
    skipIf(condition: unknown): TestFn;
    if(condition: unknown): TestFn;
    skip: TestFn;
    todo: TestFn;
  }

  export const test: TestScope;
  export const describe: TestScope;

  export function expect(actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toHaveLength(length: number): void;
    toBeGreaterThan(n: number): void;
  };

  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
}
