import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { apiErrorResponse } from "@/lib/errors";
import { recordPlaceView, recordPublicPlaceView, type PublicPlaceViewKey } from "@/lib/user-place-views";
import { requireUuidParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PLACE_VIEWER_COOKIE = "aigo_place_viewer";
const PLACE_VIEWER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type RouteContext = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { placeId: rawPlaceId } = await context.params;
    const placeId = requireUuidParam(rawPlaceId, "placeId");
    const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
    const cookieValue = request.cookies.get(PLACE_VIEWER_COOKIE)?.value ?? randomUUID();
    const publicView = await recordPublicPlaceView(placeId, placeViewDedupeKeys(request, cookieValue, user?.id));

    let userView = null;
    if (user) {
      userView = await recordPlaceView(placeId, user.id);
    }

    const response = NextResponse.json({
      item: {
        ...publicView.item,
        userView: userView?.item ?? null
      }
    });
    if (!request.cookies.get(PLACE_VIEWER_COOKIE)?.value) {
      response.cookies.set(PLACE_VIEWER_COOKIE, cookieValue, {
        httpOnly: true,
        maxAge: PLACE_VIEWER_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      });
    }

    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function placeViewDedupeKeys(request: NextRequest, deviceId: string, userId?: string): PublicPlaceViewKey[] {
  const keys: PublicPlaceViewKey[] = [];
  if (userId) keys.push({ kind: "user", value: userId });
  keys.push({ kind: "device", value: deviceId });

  const ip = clientIp(request);
  if (ip) keys.push({ kind: "ip", value: ip });

  return keys;
}

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || request.headers.get("cf-connecting-ip")?.trim() || null;
}
