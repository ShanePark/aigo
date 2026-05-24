import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse, ApiError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/route-params";
import { createVisitPhoto, VISIT_PHOTO_MAX_BYTES } from "@/lib/visit-photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    visitId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { visitId: rawVisitId } = await context.params;
    const visitId = requireUuidParam(rawVisitId, "visitId");
    const user = await requireCurrentUser(request);
    const formData = await request.formData();
    const file = formData.get("photo");
    const visibility = normalizeVisibility(formData.get("visibility"));

    if (!(file instanceof File)) {
      throw new ApiError(400, "Multipart field 'photo' is required");
    }
    if (file.size > VISIT_PHOTO_MAX_BYTES) {
      throw new ApiError(413, "Photo file must be 10MB or smaller");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    return NextResponse.json(
      await createVisitPhoto(
        visitId,
        user.id,
        {
          bytes,
          name: file.name,
          type: file.type
        },
        visibility
      ),
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function normalizeVisibility(value: FormDataEntryValue | null) {
  if (value === null || value === "") return undefined;
  if (value === "public" || value === "private") return value;
  throw new ApiError(400, "Photo visibility must be public or private");
}
