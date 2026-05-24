import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "@/lib/errors";
import {
  createVisitPhoto,
  detectVisitPhotoMime,
  getVisitPhotoForStreaming,
  resolveVisitPhotoPath,
  validateVisitPhotoFile,
  VISIT_PHOTO_MAX_BYTES
} from "@/lib/visit-photos";

type QueryResponse = Array<Record<string, unknown>>;

const originalUploadDir = process.env.AIGO_UPLOAD_DIR;
const tempUploadDirs: string[] = [];

const pngOneByOne = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);

const jpegWithSof = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20,
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9
]);

function fakeExecutor(responses: QueryResponse[]) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const executor = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return responses.shift() ?? [];
  }) as never;

  return { calls, executor };
}

async function useTempUploadDir() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aigo-visit-photos-"));
  tempUploadDirs.push(directory);
  process.env.AIGO_UPLOAD_DIR = directory;
  return directory;
}

afterEach(async () => {
  if (originalUploadDir === undefined) {
    delete process.env.AIGO_UPLOAD_DIR;
  } else {
    process.env.AIGO_UPLOAD_DIR = originalUploadDir;
  }

  await Promise.all(tempUploadDirs.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("visit photo validation", () => {
  it("accepts png files and records basic metadata", () => {
    expect(validateVisitPhotoFile({ bytes: pngOneByOne, name: "../family.png", type: "image/png" })).toEqual({
      originalFilename: "family.png",
      mimeType: "image/png",
      byteSize: pngOneByOne.byteLength,
      width: 1,
      height: 1
    });
  });

  it("sniffs jpeg dimensions from SOF metadata", () => {
    expect(validateVisitPhotoFile({ bytes: jpegWithSof, name: "photo.jpg", type: "image/jpeg" })).toMatchObject({
      mimeType: "image/jpeg",
      width: 32,
      height: 16
    });
  });

  it("rejects MIME mismatches and unsupported content", () => {
    expect(() => validateVisitPhotoFile({ bytes: pngOneByOne, name: "photo.jpg", type: "image/jpeg" })).toThrow(ApiError);
    expect(detectVisitPhotoMime(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateVisitPhotoFile({ bytes: new Uint8Array(), name: "empty.png", type: "image/png" })).toThrow("empty");
    expect(() =>
      validateVisitPhotoFile({
        bytes: new Uint8Array(VISIT_PHOTO_MAX_BYTES + 1),
        name: "huge.png",
        type: "image/png"
      })
    ).toThrow("10MB");
  });

  it("keeps storage keys inside the upload root", () => {
    expect(() => resolveVisitPhotoPath("../outside.png")).toThrow("Invalid photo storage key");
    expect(resolveVisitPhotoPath("visit-photos/visit/photo.png")).toContain("data/uploads/visit-photos/visit/photo.png");
  });
});

describe("visit photo privacy", () => {
  const visitId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const placeId = "33333333-3333-4333-8333-333333333333";
  const photoId = "44444444-4444-4444-8444-444444444444";

  it("coerces photos on private visits to private even when public is requested", async () => {
    await useTempUploadDir();
    const { calls, executor } = fakeExecutor([
      [{ id: visitId, userId, placeId, visibility: "private" }],
      [
        {
          id: photoId,
          visitId,
          userId,
          placeId,
          storageKey: `visit-photos/${visitId}/${photoId}.png`,
          originalFilename: "family.png",
          mimeType: "image/png",
          byteSize: pngOneByOne.byteLength,
          width: 1,
          height: 1,
          visibility: "private",
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        }
      ]
    ]);

    await expect(
      createVisitPhoto(visitId, userId, { bytes: pngOneByOne, name: "family.png", type: "image/png" }, "public", executor)
    ).resolves.toMatchObject({
      photo: {
        visibility: "private"
      }
    });
    expect(calls[1]?.values.at(-1)).toBe("private");
  });

  it("does not stream public photos from private visits to anonymous viewers", async () => {
    const { executor } = fakeExecutor([
      [
        {
          id: photoId,
          visitId,
          userId,
          placeId,
          storageKey: `visit-photos/${visitId}/${photoId}.png`,
          originalFilename: "family.png",
          mimeType: "image/png",
          byteSize: pngOneByOne.byteLength,
          width: 1,
          height: 1,
          visibility: "public",
          visitVisibility: "private",
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        }
      ]
    ]);

    await expect(getVisitPhotoForStreaming(photoId, null, executor)).rejects.toThrow("Photo not found");
  });
});
