import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupOrphanVisitPhotoFiles,
  collectVisitPhotoUploadFiles,
  findOrphanVisitPhotoFiles,
  formatVisitPhotoOrphanCleanupReport,
  parseArgs
} from "./cleanup-orphan-visit-photos";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("visit photo orphan cleanup", () => {
  it("defaults to dry-run and parses explicit delete options", () => {
    expect(parseArgs([])).toMatchObject({ deleteFiles: false, json: false });
    expect(parseArgs(["--delete", "--json", "--upload-root=/tmp/aigo-uploads"])).toMatchObject({
      deleteFiles: true,
      json: true,
      uploadRoot: "/tmp/aigo-uploads"
    });
    expect(parseArgs(["--delete", "--dry-run"])).toMatchObject({ deleteFiles: false });
  });

  it("collects only files under the visit photo storage prefix", async () => {
    const uploadRoot = await makeUploadRoot();
    await writeUploadFile(uploadRoot, "visit-photos/visit-a/known.png", "known");
    await writeUploadFile(uploadRoot, "visit-photos/visit-b/orphan.jpg", "orphan");
    await writeUploadFile(uploadRoot, "avatars/ignored.png", "ignored");

    const files = await collectVisitPhotoUploadFiles(uploadRoot);

    expect(files.map((file) => file.storageKey)).toEqual(["visit-photos/visit-a/known.png", "visit-photos/visit-b/orphan.jpg"]);
    expect(findOrphanVisitPhotoFiles(files, new Set(["visit-photos/visit-a/known.png"]))).toMatchObject([
      { storageKey: "visit-photos/visit-b/orphan.jpg" }
    ]);
  });

  it("reports orphan files in dry-run without deleting them", async () => {
    const uploadRoot = await makeUploadRoot();
    await writeUploadFile(uploadRoot, "visit-photos/visit-a/known.png", "known");
    await writeUploadFile(uploadRoot, "visit-photos/visit-a/orphan.png", "orphan");

    const report = await cleanupOrphanVisitPhotoFiles({
      deleteFiles: false,
      knownStorageKeys: new Set(["visit-photos/visit-a/known.png"]),
      uploadRoot
    });

    expect(report).toMatchObject({ deletedCount: 0, orphanCount: 1, scannedCount: 2 });
    expect(await readFile(path.join(uploadRoot, "visit-photos/visit-a/orphan.png"), "utf8")).toBe("orphan");
    expect(formatVisitPhotoOrphanCleanupReport(report)).toContain("Run again with --delete");
  });

  it("deletes orphan files only when explicitly requested", async () => {
    const uploadRoot = await makeUploadRoot();
    await writeUploadFile(uploadRoot, "visit-photos/visit-a/known.png", "known");
    await writeUploadFile(uploadRoot, "visit-photos/visit-a/orphan.png", "orphan");

    const report = await cleanupOrphanVisitPhotoFiles({
      deleteFiles: true,
      knownStorageKeys: new Set(["visit-photos/visit-a/known.png"]),
      uploadRoot
    });

    expect(report).toMatchObject({ deletedCount: 1, orphanCount: 1, scannedCount: 2 });
    await expect(readFile(path.join(uploadRoot, "visit-photos/visit-a/known.png"), "utf8")).resolves.toBe("known");
    await expect(readFile(path.join(uploadRoot, "visit-photos/visit-a/orphan.png"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });
});

async function makeUploadRoot() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aigo-orphan-photos-"));
  tempDirs.push(directory);
  return directory;
}

async function writeUploadFile(uploadRoot: string, storageKey: string, content: string) {
  const filePath = path.join(uploadRoot, ...storageKey.split("/"));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}
