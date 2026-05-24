import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type postgres from "postgres";

import { pg } from "@/db/client";
import { ApiError } from "@/lib/errors";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export const VISIT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const VISIT_PHOTO_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type VisitPhotoMimeType = (typeof VISIT_PHOTO_ALLOWED_MIME_TYPES)[number];
type VisitPhotoVisibility = "public" | "private";

export type VisitPhotoFileInput = {
  bytes: Uint8Array;
  name?: string | null;
  type?: string | null;
};

type VisitPhotoRow = {
  id: string;
  visitId: string;
  userId: string;
  placeId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: VisitPhotoMimeType;
  byteSize: number | string;
  width: number | string | null;
  height: number | string | null;
  visibility: VisitPhotoVisibility;
  createdAt: Date | string;
};

type VisitPhotoAccessRow = VisitPhotoRow & {
  visitVisibility: VisitPhotoVisibility;
};

export type VisitPhotoItem = {
  id: string;
  visitId: string;
  placeId: string;
  url: string;
  originalFilename: string;
  mimeType: VisitPhotoMimeType;
  byteSize: number;
  width: number | null;
  height: number | null;
  visibility: VisitPhotoVisibility;
  createdAt: string;
};

type VisitPhotoValidation = {
  originalFilename: string;
  mimeType: VisitPhotoMimeType;
  byteSize: number;
  width: number | null;
  height: number | null;
};

export async function createVisitPhoto(
  visitId: string,
  userId: string,
  file: VisitPhotoFileInput,
  visibility?: VisitPhotoVisibility,
  executor: SqlExecutor = pg
) {
  const visitRows = await executor<{ id: string; userId: string; placeId: string; visibility: VisitPhotoVisibility }[]>`
    select id::text as id, user_id::text as "userId", place_id::text as "placeId", visibility
    from place_visits
    where id = ${visitId}
    limit 1
  `;
  const visit = visitRows[0];
  if (!visit) {
    throw new ApiError(404, "Visit not found");
  }
  if (visit.userId !== userId) {
    throw new ApiError(403, "Photos can only be added by the visit owner");
  }

  const validation = validateVisitPhotoFile(file);
  const photoId = randomUUID();
  const storageKey = `visit-photos/${visitId}/${photoId}.${extensionForMime(validation.mimeType)}`;
  const uploadPath = resolveVisitPhotoPath(storageKey);
  const photoVisibility = visit.visibility === "private" ? "private" : visibility ?? visit.visibility;

  await mkdir(path.dirname(uploadPath), { recursive: true });
  await writeFile(uploadPath, file.bytes);

  try {
    const rows = await executor<VisitPhotoRow[]>`
      insert into place_visit_photos (
        id,
        visit_id,
        user_id,
        place_id,
        storage_key,
        original_filename,
        mime_type,
        byte_size,
        width,
        height,
        visibility
      )
      values (
        ${photoId},
        ${visitId},
        ${userId},
        ${visit.placeId},
        ${storageKey},
        ${validation.originalFilename},
        ${validation.mimeType},
        ${validation.byteSize},
        ${validation.width},
        ${validation.height},
        ${photoVisibility}
      )
      returning
        id::text as id,
        visit_id::text as "visitId",
        user_id::text as "userId",
        place_id::text as "placeId",
        storage_key as "storageKey",
        original_filename as "originalFilename",
        mime_type as "mimeType",
        byte_size as "byteSize",
        width,
        height,
        visibility,
        created_at as "createdAt"
    `;

    return { photo: visitPhotoItemFromRow(rows[0]) };
  } catch (error) {
    await rm(uploadPath, { force: true });
    throw error;
  }
}

export async function getVisitPhotoForStreaming(photoId: string, viewerUserId?: string | null, executor: SqlExecutor = pg) {
  const rows = await executor<VisitPhotoAccessRow[]>`
    select
      ph.id::text as id,
      ph.visit_id::text as "visitId",
      ph.user_id::text as "userId",
      ph.place_id::text as "placeId",
      ph.storage_key as "storageKey",
      ph.original_filename as "originalFilename",
      ph.mime_type as "mimeType",
      ph.byte_size as "byteSize",
      ph.width,
      ph.height,
      ph.visibility,
      ph.created_at as "createdAt",
      v.visibility as "visitVisibility"
    from place_visit_photos ph
    join place_visits v on v.id = ph.visit_id
    where ph.id = ${photoId}
    limit 1
  `;
  const photo = rows[0];
  if (!photo || ((photo.visibility === "private" || photo.visitVisibility === "private") && photo.userId !== viewerUserId)) {
    throw new ApiError(404, "Photo not found");
  }

  const filePath = resolveVisitPhotoPath(photo.storageKey);
  try {
    const [bytes, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return {
      photo: visitPhotoItemFromRow(photo),
      bytes,
      byteSize: fileStat.size
    };
  } catch {
    throw new ApiError(404, "Photo file not found");
  }
}

export function validateVisitPhotoFile(file: VisitPhotoFileInput): VisitPhotoValidation {
  const byteSize = file.bytes.byteLength;
  if (byteSize <= 0) {
    throw new ApiError(400, "Photo file is empty");
  }
  if (byteSize > VISIT_PHOTO_MAX_BYTES) {
    throw new ApiError(413, "Photo file must be 10MB or smaller");
  }

  const mimeType = detectVisitPhotoMime(file.bytes);
  if (!mimeType) {
    throw new ApiError(400, "Photo file must be a JPEG, PNG, or WebP image");
  }
  if (file.type && file.type !== mimeType) {
    throw new ApiError(400, "Photo MIME type does not match the file content");
  }

  const dimensions = readImageDimensions(file.bytes, mimeType);
  return {
    originalFilename: sanitizeOriginalFilename(file.name, mimeType),
    mimeType,
    byteSize,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null
  };
}

export function detectVisitPhotoMime(bytes: Uint8Array): VisitPhotoMimeType | null {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function resolveVisitPhotoPath(storageKey: string) {
  const root = uploadRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new ApiError(400, "Invalid photo storage key");
  }
  return resolved;
}

function visitPhotoItemFromRow(row: VisitPhotoRow): VisitPhotoItem {
  return {
    id: row.id,
    visitId: row.visitId,
    placeId: row.placeId,
    url: `/api/visit-photos/${row.id}`,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    byteSize: Number(row.byteSize),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    visibility: row.visibility,
    createdAt: dateTimeString(row.createdAt)
  };
}

function uploadRoot() {
  return path.resolve(process.env.AIGO_UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));
}

function extensionForMime(mimeType: VisitPhotoMimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function sanitizeOriginalFilename(name: string | null | undefined, mimeType: VisitPhotoMimeType) {
  const fallback = `photo.${extensionForMime(mimeType)}`;
  const trimmed = path.basename(name ?? "").replace(/[\u0000-\u001f]/g, "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 255) : fallback;
}

function readImageDimensions(bytes: Uint8Array, mimeType: VisitPhotoMimeType) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mimeType === "image/png" && buffer.length >= 24) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if (mimeType === "image/webp" && buffer.length >= 30 && buffer.toString("ascii", 12, 16) === "VP8X") {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1
    };
  }

  if (mimeType === "image/jpeg") {
    return readJpegDimensions(buffer);
  }

  return null;
}

function readJpegDimensions(buffer: Buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda || offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

    if (isJpegStartOfFrame(marker) && offset + 7 <= buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }

    offset += segmentLength;
  }

  return null;
}

function isJpegStartOfFrame(marker: number) {
  return (
    marker === 0xc0 ||
    marker === 0xc1 ||
    marker === 0xc2 ||
    marker === 0xc3 ||
    marker === 0xc5 ||
    marker === 0xc6 ||
    marker === 0xc7 ||
    marker === 0xc9 ||
    marker === 0xca ||
    marker === 0xcb ||
    marker === 0xcd ||
    marker === 0xce ||
    marker === 0xcf
  );
}

function dateTimeString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
