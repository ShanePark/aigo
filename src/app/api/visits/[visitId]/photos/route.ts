import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/app-auth";
import { apiErrorResponse, ApiError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/route-params";
import { createVisitPhoto, VISIT_PHOTO_MAX_BYTES, VISIT_PHOTO_MAX_FILES_PER_UPLOAD } from "@/lib/visit-photos";

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
    rejectOversizedContentLength(request);
    const user = await requireCurrentUser(request);
    const formData = await request.formData();
    const files = formData
      .getAll("photos")
      .concat(formData.getAll("photo"))
      .filter((file): file is File => file instanceof File && file.size > 0);
    const visibility = normalizeVisibility(formData.get("visibility"));

    if (files.length === 0) {
      throw new ApiError(400, "Multipart field 'photos' is required");
    }
    if (files.length > VISIT_PHOTO_MAX_FILES_PER_UPLOAD) {
      throw new ApiError(413, `Upload up to ${VISIT_PHOTO_MAX_FILES_PER_UPLOAD} photos at a time`);
    }

    const photos = [];
    for (const file of files) {
      if (file.size > VISIT_PHOTO_MAX_BYTES) {
        throw new ApiError(413, "Each photo file must be 10MB or smaller");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await createVisitPhoto(
        visitId,
        user.id,
        {
          bytes,
          name: file.name,
          type: file.type
        },
        visibility
      );
      photos.push(result.photo);
    }

    return NextResponse.json({ photos }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function normalizeVisibility(value: FormDataEntryValue | null) {
  if (value === null || value === "") return undefined;
  if (value === "public" || value === "private") return value;
  throw new ApiError(400, "Photo visibility must be public or private");
}

function rejectOversizedContentLength(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return;

  const byteSize = Number(contentLength);
  if (Number.isFinite(byteSize) && byteSize > VISIT_PHOTO_MAX_BYTES * VISIT_PHOTO_MAX_FILES_PER_UPLOAD) {
    throw new ApiError(413, `Photo upload request must be ${VISIT_PHOTO_MAX_FILES_PER_UPLOAD * 10}MB or smaller`);
  }
}
