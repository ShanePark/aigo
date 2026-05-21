import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { findDuplicatePlaces } from "@/lib/places";
import { duplicatePlaceSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireApiKey(request);
    const input = duplicatePlaceSchema.parse(await readJson(request));
    return NextResponse.json(await findDuplicatePlaces(input));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

