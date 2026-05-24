import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { getVisitPhotoForStreaming } from "@/lib/visit-photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    photoId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { photoId } = await context.params;
    const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
    const result = await getVisitPhotoForStreaming(photoId, user?.id);

    return new NextResponse(result.bytes, {
      headers: {
        "cache-control": result.photo.visibility === "public" ? "public, max-age=31536000, immutable" : "private, max-age=0",
        "content-disposition": contentDisposition(result.photo.originalFilename),
        "content-length": String(result.byteSize),
        "content-type": result.photo.mimeType
      }
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function contentDisposition(filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7e]|["\\;\r\n]/g, "_").trim() || "photo";
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
