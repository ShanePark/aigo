import { readFileSync } from "node:fs";
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

const pngFixture = fixtureBytes("public/icons/icon-16.png");
const webpFixture = fixtureBytes("public/icons/child-profiles/boy-under6-avatar.webp");
const jpegFixture = bytesFromBase64(
  [
    "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQA",
    "AAABAAAAEKADAAQAAAABAAAAEAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmA",
    "CZjs+EJ+/8AAEQgAEAAQAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQE",
    "AAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldY",
    "WVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk",
    "5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMR",
    "BAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdo",
    "aWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz",
    "9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8P",
    "D//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQA",
    "Af/aAAwDAQACEQMRAD8A/WX4lfE7UvDIt7a2sobu9u3d1MsmI0hRlUlgQAp+YAfNj1Na3w98ba34gkne8tYtNl0wsl7bj72/koVI",
    "yCCvvjuCRXxX4w1fxaut6l4d8cvZ6NqGk3V15ButRgia4gMmYXhDyBgkkYB+bGGA9Dn2HwNrtyk2m+EPBl5Y63das4k1CexvoJmh",
    "BG0ZVXLBIl44G3354+Ar4bF/Wrvm5U27rsmkrJatt3b6ctvO30tDP8BLLdIR9ppG2vPz3bk3f3eRQ5UuvPdW7//Z"
  ].join("")
);
const pngHeaderOnly = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);
const webpHeaderOnly = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

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

function fixtureBytes(relativePath: string) {
  return new Uint8Array(readFileSync(path.join(process.cwd(), relativePath)));
}

function bytesFromBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
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
    expect(validateVisitPhotoFile({ bytes: pngFixture, name: "../family.png", type: "image/png" })).toEqual({
      originalFilename: "family.png",
      mimeType: "image/png",
      byteSize: pngFixture.byteLength,
      width: 16,
      height: 16
    });
  });

  it("accepts jpeg files after complete image structure validation", () => {
    expect(validateVisitPhotoFile({ bytes: jpegFixture, name: "photo.jpg", type: "image/jpeg" })).toMatchObject({
      mimeType: "image/jpeg",
      width: 16,
      height: 16
    });
  });

  it("accepts webp files and records dimensions", () => {
    expect(validateVisitPhotoFile({ bytes: webpFixture, name: "avatar.webp", type: "image/webp" })).toMatchObject({
      mimeType: "image/webp",
      width: 256,
      height: 256
    });
  });

  it("rejects truncated images and header-only payloads", () => {
    expect(() => validateVisitPhotoFile({ bytes: pngHeaderOnly, name: "truncated.png", type: "image/png" })).toThrow(
      "complete"
    );
    expect(() =>
      validateVisitPhotoFile({
        bytes: jpegFixture.slice(0, Math.floor(jpegFixture.byteLength / 2)),
        name: "truncated.jpg",
        type: "image/jpeg"
      })
    ).toThrow("complete");
    expect(() => validateVisitPhotoFile({ bytes: webpHeaderOnly, name: "truncated.webp", type: "image/webp" })).toThrow(
      "complete"
    );
  });

  it("rejects MIME mismatches and unsupported content", () => {
    expect(() => validateVisitPhotoFile({ bytes: pngFixture, name: "photo.jpg", type: "image/jpeg" })).toThrow(ApiError);
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
          byteSize: pngFixture.byteLength,
          width: 16,
          height: 16,
          visibility: "private",
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        }
      ]
    ]);

    await expect(
      createVisitPhoto(visitId, userId, { bytes: pngFixture, name: "family.png", type: "image/png" }, "public", executor)
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
          byteSize: pngFixture.byteLength,
          width: 16,
          height: 16,
          visibility: "public",
          visitVisibility: "private",
          createdAt: new Date("2026-05-24T00:00:00.000Z")
        }
      ]
    ]);

    await expect(getVisitPhotoForStreaming(photoId, null, executor)).rejects.toThrow("Photo not found");
  });
});
