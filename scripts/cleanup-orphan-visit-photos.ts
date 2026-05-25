import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

import { env } from "@/env";
import { VISIT_PHOTO_STORAGE_PREFIX, visitPhotoUploadRoot } from "@/lib/visit-photos";

type CleanupArgs = {
  databaseUrl: string;
  deleteFiles: boolean;
  json: boolean;
  uploadRoot: string;
};

export type VisitPhotoUploadFile = {
  byteSize: number;
  path: string;
  storageKey: string;
};

export type VisitPhotoOrphanCleanupReport = {
  deletedCount: number;
  deleteFiles: boolean;
  orphanBytes: number;
  orphanCount: number;
  orphans: VisitPhotoUploadFile[];
  scannedCount: number;
  uploadRoot: string;
};

if (isMain()) {
  void main();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sql = postgres(args.databaseUrl, { max: 1, prepare: false });

  try {
    const storageKeys = await readVisitPhotoStorageKeys(sql);
    const report = await cleanupOrphanVisitPhotoFiles({
      deleteFiles: args.deleteFiles,
      knownStorageKeys: storageKeys,
      uploadRoot: args.uploadRoot
    });
    console.log(args.json ? JSON.stringify(report, null, 2) : formatVisitPhotoOrphanCleanupReport(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

export function parseArgs(argv: string[]): CleanupArgs {
  const args: CleanupArgs = {
    databaseUrl: env.databaseUrl,
    deleteFiles: false,
    json: false,
    uploadRoot: visitPhotoUploadRoot()
  };

  for (const arg of argv) {
    if (arg === "--delete") {
      args.deleteFiles = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.deleteFiles = false;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg.startsWith("--database-url=")) {
      args.databaseUrl = requiredValue(arg, "--database-url=");
      continue;
    }
    if (arg.startsWith("--upload-root=")) {
      args.uploadRoot = path.resolve(requiredValue(arg, "--upload-root="));
      continue;
    }

    throw new Error(
      "Usage: pnpm tsx scripts/cleanup-orphan-visit-photos.ts [--dry-run] [--delete] [--json] [--upload-root=<path>] [--database-url=<url>]"
    );
  }

  return args;
}

export async function readVisitPhotoStorageKeys(sql: postgres.Sql) {
  const rows = await sql<{ storageKey: string }[]>`
    select storage_key as "storageKey"
    from place_visit_photos
  `;
  return new Set(rows.map((row) => row.storageKey));
}

export async function cleanupOrphanVisitPhotoFiles(input: {
  deleteFiles: boolean;
  knownStorageKeys: Set<string>;
  uploadRoot: string;
}): Promise<VisitPhotoOrphanCleanupReport> {
  const uploadRoot = path.resolve(input.uploadRoot);
  const files = await collectVisitPhotoUploadFiles(uploadRoot);
  const orphans = findOrphanVisitPhotoFiles(files, input.knownStorageKeys);

  if (input.deleteFiles) {
    await Promise.all(orphans.map((orphan) => rm(orphan.path, { force: true })));
  }

  return {
    deletedCount: input.deleteFiles ? orphans.length : 0,
    deleteFiles: input.deleteFiles,
    orphanBytes: orphans.reduce((sum, orphan) => sum + orphan.byteSize, 0),
    orphanCount: orphans.length,
    orphans,
    scannedCount: files.length,
    uploadRoot
  };
}

export async function collectVisitPhotoUploadFiles(uploadRoot: string): Promise<VisitPhotoUploadFile[]> {
  const root = path.resolve(uploadRoot);
  const visitPhotoRoot = path.join(root, VISIT_PHOTO_STORAGE_PREFIX);

  try {
    const visitPhotoRootStat = await stat(visitPhotoRoot);
    if (!visitPhotoRootStat.isDirectory()) {
      return [];
    }
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }

  const files: VisitPhotoUploadFile[] = [];
  await collectFiles(visitPhotoRoot, root, files);
  return files.sort((a, b) => a.storageKey.localeCompare(b.storageKey));
}

export function findOrphanVisitPhotoFiles(files: VisitPhotoUploadFile[], knownStorageKeys: Set<string>) {
  return files.filter((file) => !knownStorageKeys.has(file.storageKey));
}

export function formatVisitPhotoOrphanCleanupReport(report: VisitPhotoOrphanCleanupReport) {
  const action = report.deleteFiles ? "deleted" : "dry-run";
  const lines = [
    `Visit photo orphan cleanup ${action}: scanned ${report.scannedCount} file(s), found ${report.orphanCount} orphan file(s), ${report.orphanBytes} byte(s).`,
    `Upload root: ${report.uploadRoot}`
  ];

  for (const orphan of report.orphans) {
    lines.push(`- ${orphan.storageKey} (${orphan.byteSize} bytes)`);
  }

  if (!report.deleteFiles && report.orphanCount > 0) {
    lines.push("Run again with --delete to remove the orphan files.");
  }

  return lines.join("\n");
}

async function collectFiles(directory: string, uploadRoot: string, files: VisitPhotoUploadFile[]) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, uploadRoot, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(entryPath);
    files.push({
      byteSize: fileStat.size,
      path: entryPath,
      storageKey: path.relative(uploadRoot, entryPath).split(path.sep).join("/")
    });
  }
}

function requiredValue(arg: string, prefix: string) {
  const value = arg.slice(prefix.length).trim();
  if (!value) {
    throw new Error(`${prefix.slice(0, -1)} requires a value`);
  }
  return value;
}

function isNodeErrorCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function isMain() {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}
