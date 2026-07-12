import { describe, expect, mock, test } from "bun:test";
import { eq, getTableName } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { otpCodes, users } from "../../../schema";
import { applyIncludes, getJoinCondition } from "../applyIncludes";

describe("db/queries/utils/applyIncludes.ts", () => {
  describe("getJoinCondition", () => {
    test("throws when no FK exists between unrelated tables", () => {
      expect(() => getJoinCondition(users, otpCodes)).toThrow(
        `No foreign key found between "${getTableName(users)}" and "${getTableName(otpCodes)}".`,
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
      const manualCondition = eq(users.phone, otpCodes.phone);

      applyIncludes({
        query: query as never,
        mainTable: users,
        include: [{ table: otpCodes, on: manualCondition }],
      });

      expect(query.innerJoin).toHaveBeenCalledTimes(1);
      expect(query.leftJoin).not.toHaveBeenCalled();
      expect(query.innerJoin.mock.calls[0]![0]).toBe(otpCodes);
      expect(query.innerJoin.mock.calls[0]![1]).toBe(manualCondition);
    });

    test("falls back to FK auto-detection when alias and on are absent, throwing when no FK exists", () => {
      const query = createMockQuery();

      expect(() =>
        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [{ table: otpCodes }],
        }),
      ).toThrow(
        `No foreign key found between "${getTableName(users)}" and "${getTableName(otpCodes)}".`,
      );
    });

    test("uses alias as join target when provided", () => {
      const query = createMockQuery();
      const activeOtpCodes = alias(otpCodes, "activeOtpCodes");
      const onCondition = eq(users.phone, activeOtpCodes.phone);

      applyIncludes({
        query: query as never,
        mainTable: users,
        include: [{ table: otpCodes, alias: activeOtpCodes, on: onCondition }],
      });

      expect(query.innerJoin).toHaveBeenCalledTimes(1);
      expect(query.leftJoin).not.toHaveBeenCalled();
      expect(query.innerJoin.mock.calls[0]![0]).toBe(activeOtpCodes);
      expect(query.innerJoin.mock.calls[0]![1]).toBeDefined();
    });

    test("throws error when aliased include lacks on", () => {
      const query = createMockQuery();
      const activeOtpCodes = alias(otpCodes, "activeOtpCodes");

      expect(() =>
        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [{ table: otpCodes, alias: activeOtpCodes }],
        }),
      ).toThrow(
        'Include for "otp_codes" with alias "activeOtpCodes" must provide an explicit "on" condition (FK auto-detection is not supported on aliased tables).',
      );
    });

    test("throws error when nested include under aliased parent lacks on", () => {
      const query = createMockQuery();
      const verifiedUsers = alias(users, "verifiedUsers");

      expect(() =>
        applyIncludes({
          query: query as never,
          mainTable: otpCodes,
          include: [
            {
              table: users,
              alias: verifiedUsers,
              on: eq(otpCodes.phone, verifiedUsers.phone),
              include: [{ table: otpCodes }],
            },
          ],
        }),
      ).toThrow(
        'Nested include for "otp_codes" under aliased table "verifiedUsers" must provide an explicit "on" condition (FK auto-detection is not supported on aliased tables).',
      );
    });

    describe("left join support (required: false)", () => {
      test("calls `leftJoin` when `required` is `false`", () => {
        const query = createMockQuery();

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: otpCodes,
              on: eq(users.phone, otpCodes.phone),
              required: false,
            },
          ],
        });

        expect(query.leftJoin).toHaveBeenCalledTimes(1);
        expect(query.innerJoin).not.toHaveBeenCalled();
        expect(query.leftJoin.mock.calls[0]![0]).toBe(otpCodes);
      });

      test("calls `innerJoin` when `required` is explicitly `true`", () => {
        const query = createMockQuery();

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: otpCodes,
              on: eq(users.phone, otpCodes.phone),
              required: true,
            },
          ],
        });

        expect(query.innerJoin).toHaveBeenCalledTimes(1);
        expect(query.leftJoin).not.toHaveBeenCalled();
        expect(query.innerJoin.mock.calls[0]![0]).toBe(otpCodes);
      });

      test("calls `innerJoin` by default when `required` is omitted", () => {
        const query = createMockQuery();

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [{ table: otpCodes, on: eq(users.phone, otpCodes.phone) }],
        });

        expect(query.innerJoin).toHaveBeenCalledTimes(1);
        expect(query.leftJoin).not.toHaveBeenCalled();
        expect(query.innerJoin.mock.calls[0]![0]).toBe(otpCodes);
      });

      test("mixed joins: includes with different `required` values", () => {
        const query = createMockQuery();
        const activeOtpCodes = alias(otpCodes, "activeOtpCodes");

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: otpCodes,
              on: eq(users.phone, otpCodes.phone),
              required: true,
            },
            {
              table: otpCodes,
              alias: activeOtpCodes,
              on: eq(users.phone, activeOtpCodes.phone),
              required: false,
            },
          ],
        });

        expect(query.innerJoin).toHaveBeenCalledTimes(1);
        expect(query.leftJoin).toHaveBeenCalledTimes(1);

        // First call: innerJoin for otpCodes
        expect(query.innerJoin.mock.calls[0]![0]).toBe(otpCodes);

        // Second call: leftJoin for the aliased otpCodes
        expect(query.leftJoin.mock.calls[0]![0]).toBe(activeOtpCodes);
      });

      test("left join with alias", () => {
        const query = createMockQuery();
        const activeOtpCodes = alias(otpCodes, "activeOtpCodes");
        const onCondition = eq(users.phone, activeOtpCodes.phone);

        applyIncludes({
          query: query as never,
          mainTable: users,
          include: [
            {
              table: otpCodes,
              alias: activeOtpCodes,
              on: onCondition,
              required: false,
            },
          ],
        });

        expect(query.leftJoin).toHaveBeenCalledTimes(1);
        expect(query.innerJoin).not.toHaveBeenCalled();
        expect(query.leftJoin.mock.calls[0]![0]).toBe(activeOtpCodes);
        expect(query.leftJoin.mock.calls[0]![1]).toBeDefined();
      });
    });
  });
});
