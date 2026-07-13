import { describe, expect, mock, test } from "bun:test";
import { eq, getTableName } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { users } from "../../../schema";
import { applyIncludes, getJoinCondition } from "../applyIncludes";

describe("db/queries/utils/applyIncludes.ts", () => {
  describe("getJoinCondition", () => {
    test("throws when no FK exists between the tables", () => {
      expect(() => getJoinCondition(users, users)).toThrow(
        `No foreign key found between "${getTableName(users)}" and "${getTableName(users)}".`,
      );
    });
  });

  describe("applyIncludes", () => {
    /**
     * Creates a mock query with spies on `innerJoin` and `leftJoin`.
     * Each spy returns the query itself, matching Drizzle's chainable API.
     * @returns A mock query object with `innerJoin` and `leftJoin` spies.
     */
    function createMockQuery(): {
      innerJoin: ReturnType<typeof mock>;
      leftJoin: ReturnType<typeof mock>;
    } {
      const query: {
        innerJoin: ReturnType<typeof mock>;
        leftJoin: ReturnType<typeof mock>;
      } = {
        innerJoin: mock(() => query),
        leftJoin: mock(() => query),
      };
      return query;
    }

    test("is a no-op when include is undefined", () => {
      const query = createMockQuery();

      applyIncludes({
        query: query as never,
        mainTable: users,
        include: undefined,
      });

      expect(query.innerJoin).not.toHaveBeenCalled();
      expect(query.leftJoin).not.toHaveBeenCalled();
    });

    test("is a no-op when include is an empty array", () => {
      const query = createMockQuery();

      applyIncludes({
        query: query as never,
        mainTable: users,
        include: [],
      });

      expect(query.innerJoin).not.toHaveBeenCalled();
      expect(query.leftJoin).not.toHaveBeenCalled();
    });

    test("uses on condition instead of FK auto-detection", () => {
      const query = createMockQuery();
      const managers = alias(users, "managers");
      const manualCondition = eq(users.id, managers.id);

      applyIncludes({
        query: query as never,
        mainTable: users,
        include: [{ table: users, alias: managers, on: manualCondition }],
      });

      expect(query.innerJoin).toHaveBeenCalledTimes(1);
      expect(query.leftJoin).not.toHaveBeenCalled();
      expect(query.innerJoin.mock.calls[0]![0]).toBe(managers);
      expect(query.innerJoin.mock.calls[0]![1]).toBe(manualCondition);
    });

    test("falls back to FK auto-detection when alias and on are absent, throwing when no FK exists", () => {
      const query = createMockQuery();

      expect(() =>
        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [{ table: users }],
        }),
      ).toThrow(
        `No foreign key found between "${getTableName(users)}" and "${getTableName(users)}".`,
      );
    });

    test("throws error when aliased include lacks on", () => {
      const query = createMockQuery();
      const managers = alias(users, "managers");

      expect(() =>
        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [{ table: users, alias: managers }],
        }),
      ).toThrow(
        'Include for "users" with alias "managers" must provide an explicit "on" condition (FK auto-detection is not supported on aliased tables).',
      );
    });

    test("throws error when nested include under aliased parent lacks on", () => {
      const query = createMockQuery();
      const managers = alias(users, "managers");

      expect(() =>
        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: users,
              alias: managers,
              on: eq(users.id, managers.id),
              include: [{ table: users }],
            },
          ],
        }),
      ).toThrow(
        'Nested include for "users" under aliased table "managers" must provide an explicit "on" condition (FK auto-detection is not supported on aliased tables).',
      );
    });

    describe("left join support (required: false)", () => {
      test("calls `leftJoin` when `required` is `false`", () => {
        const query = createMockQuery();
        const managers = alias(users, "managers");

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: users,
              alias: managers,
              on: eq(users.id, managers.id),
              required: false,
            },
          ],
        });

        expect(query.leftJoin).toHaveBeenCalledTimes(1);
        expect(query.innerJoin).not.toHaveBeenCalled();
        expect(query.leftJoin.mock.calls[0]![0]).toBe(managers);
      });

      test("calls `innerJoin` when `required` is explicitly `true`", () => {
        const query = createMockQuery();
        const managers = alias(users, "managers");

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: users,
              alias: managers,
              on: eq(users.id, managers.id),
              required: true,
            },
          ],
        });

        expect(query.innerJoin).toHaveBeenCalledTimes(1);
        expect(query.leftJoin).not.toHaveBeenCalled();
        expect(query.innerJoin.mock.calls[0]![0]).toBe(managers);
      });

      test("calls `innerJoin` by default when `required` is omitted", () => {
        const query = createMockQuery();
        const managers = alias(users, "managers");

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            { table: users, alias: managers, on: eq(users.id, managers.id) },
          ],
        });

        expect(query.innerJoin).toHaveBeenCalledTimes(1);
        expect(query.leftJoin).not.toHaveBeenCalled();
        expect(query.innerJoin.mock.calls[0]![0]).toBe(managers);
      });

      test("mixed joins: includes with different `required` values", () => {
        const query = createMockQuery();
        const managers = alias(users, "managers");
        const referrers = alias(users, "referrers");

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: users,
              alias: managers,
              on: eq(users.id, managers.id),
              required: true,
            },
            {
              table: users,
              alias: referrers,
              on: eq(users.id, referrers.id),
              required: false,
            },
          ],
        });

        expect(query.innerJoin).toHaveBeenCalledTimes(1);
        expect(query.leftJoin).toHaveBeenCalledTimes(1);

        // First call: innerJoin for the managers alias
        expect(query.innerJoin.mock.calls[0]![0]).toBe(managers);

        // Second call: leftJoin for the referrers alias
        expect(query.leftJoin.mock.calls[0]![0]).toBe(referrers);
      });
    });
  });
});
