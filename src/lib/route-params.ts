import { z } from "zod";

import { ApiError } from "@/lib/errors";

const uuidParamSchema = z.string().uuid();

export function requireUuidParam(value: string, name: string) {
  const result = uuidParamSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, `${name} must be a valid UUID`);
  }
  return result.data;
}
