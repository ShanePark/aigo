import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { listMyVisitLog } from "@/lib/place-visits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);
    return NextResponse.json(await listMyVisitLog(user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
