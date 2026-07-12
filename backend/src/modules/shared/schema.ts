import { roleSchema } from "@blueprint/enum-utils";
import { t } from "elysia";

export {
  authUser,
  type SuccessResponse,
  successResponse,
} from "@blueprint/api-utils";

// ============ Common Params ============

/** UUID path parameter schema. */
export const uuidParam = t.Object({ id: t.String({ format: "uuid" }) });

// ============ User & Auth Schemas ============

/** User role schema - user or admin. */
export const userRole = roleSchema;
