import { t } from "elysia";

export {
  type SuccessResponse,
  successResponse,
} from "@blueprint/api-utils";

// ============ Common Params ============

/** UUID path parameter schema. */
export const uuidParam = t.Object({ id: t.String({ format: "uuid" }) });
