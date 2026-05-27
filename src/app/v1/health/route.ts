import { NextRequest, NextResponse } from "next/server";

import { requireHealthApiKey } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { getAgentHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireHealthApiKey(request);
    return NextResponse.json(await getAgentHealth());
  } catch (error) {
    return apiErrorResponse(error);
  }
}
