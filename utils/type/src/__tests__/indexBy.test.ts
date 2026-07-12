import { describe, expect, test } from "bun:test";

import { indexBy } from "../indexBy";

describe("indexBy", () => {
  test("returns an empty Map for an empty array", () => {
    const result = indexBy<{ id: number }, number>([], (item) => item.id);
    expect(result.size).toBe(0);
  });

  test("indexes items by the derived key", () => {
    const items = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
      { id: "c", value: 3 },
    ];
    const result = indexBy(items, (item) => item.id);

    expect(result.size).toBe(3);
    expect(result.get("a")).toEqual({ id: "a", value: 1 });
    expect(result.get("b")).toEqual({ id: "b", value: 2 });
    expect(result.get("c")).toEqual({ id: "c", value: 3 });
  });

  test("later items overwrite earlier items with the same key", () => {
    const items = [
      { id: "a", value: 1 },
      { id: "a", value: 99 },
    ];
    const result = indexBy(items, (item) => item.id);

    expect(result.size).toBe(1);
    expect(result.get("a")).toEqual({ id: "a", value: 99 });
  });

  test("supports non-string keys (numbers)", () => {
    const items = [{ ts: 1000 }, { ts: 2000 }];
    const result = indexBy(items, (item) => item.ts);

    expect(result.get(1000)).toEqual({ ts: 1000 });
    expect(result.get(2000)).toEqual({ ts: 2000 });
  });

  test("returns undefined for missing keys", () => {
    const result = indexBy([{ id: "a" }], (item) => item.id);
    expect(result.get("missing")).toBeUndefined();
  });
});
