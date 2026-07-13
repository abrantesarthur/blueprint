import { Elysia } from "elysia";

import { findUsers } from "../../db";
import type { AuthUser } from "../types";
import { UnauthorizedError } from "../utils/errors";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Authentication middleware that extracts and verifies user from JWT token.
 * Enforces authentication and adds a `user` property to the request context.
 */
export const authMiddleware = new Elysia({ name: "auth" })
  // Use `derive` (not `resolve`) so authentication runs BEFORE body/query validation.
  // With `resolve`, unauthenticated requests to routes with a `body` schema fail
  // validation first — breaking the 401 contract — and also allow the request shape
  // to be probed without a token.
  // `scoped` propagates this derive to routes in modules that .use(authMiddleware).
  .derive(
    { as: "scoped" },
    async ({ request }): Promise<{ user: AuthUser }> => {
      const authHeader = request.headers.get("authorization");

      const bearerPrefix = "Bearer ";
      if (!authHeader?.startsWith(bearerPrefix)) {
        throw new UnauthorizedError("Authentication required");
      }

      const token = authHeader.slice(bearerPrefix.length);
      const payload = await verifyAccessToken(token);

      if (!payload) {
        throw new UnauthorizedError("Authentication required");
      }

      const [user] = await findUsers({ where: { id: payload.id }, limit: 1 });

      if (!user) {
        throw new UnauthorizedError("Authentication required");
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    },
  );
