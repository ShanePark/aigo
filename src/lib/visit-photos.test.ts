import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/errors";
import {
  detectVisitPhotoMime,
  resolveVisitPhotoPath,
  validateVisitPhotoFile,
  VISIT_PHOTO_MAX_BYTES
} from "@/lib/visit-photos";

const pngOneByOne = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);

const jpegWithSof = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20,
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9
]);

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
