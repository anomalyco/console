import { test, expect } from "bun:test";
import { disposable } from "../../src/util/disposable";

test("disposable", () => {
  let closed = false;
  (function run() {
    using thing = disposable(
      () => ({}),
      () => (closed = true),
    );
  })();
  expect(closed).toBe(true);
});
