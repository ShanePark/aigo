import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatAgentResearchArtifactSummary, parseArgs, summarizeAgentResearchArtifacts } from "./summarize-agent-research-artifacts";

describe("agent research artifact summary helper", () => {
  it("extracts durable cleanup signals from research artifacts", async () => {
    const researchDir = await mkdtemp(path.join(os.tmpdir(), "aigo-research-summary-"));
    try {
      await writeFile(
        path.join(researchDir, "seoul-shared-childcare-20260616.md"),
        [
          "# Research handoff",
          "Place id: 20fd9168-c1f7-4faf-8373-1d5c6f286e7f",
          "Suggested action: create",
          "Source: https://example.go.kr/place",
          "Image: https://example.go.kr/images/place.jpg",
          "externalRefs.coordinateProvenance.level: public_address_coordinate",
          "Blocker: official page needs updated hours."
        ].join("\n")
      );
      await writeFile(
        path.join(researchDir, "duplicate-result.json"),
        JSON.stringify({
          id: "7ba80cdb-d2e5-4766-96df-932c90cf4b82",
          suggestedAction: "manual_duplicate_review",
          url: "https://example.com/listing",
          imageUrl: "https://cdn.example.com/photo.webp"
        })
      );
      await writeFile(path.join(researchDir, "source-capture.html"), '<a href="https://example.org/page">source</a>');

      const summary = await summarizeAgentResearchArtifacts({
        researchDir,
        json: false,
        maxReadBytes: 100_000,
        maxSamples: 20
      });

      expect(summary.totals.fileCount).toBe(3);
      expect(summary.byKind.handoff).toBe(1);
      expect(summary.byKind.api_result).toBe(1);
      expect(summary.byKind.source_capture).toBe(1);
      expect(summary.extracted.productionIds).toEqual([
        "20fd9168-c1f7-4faf-8373-1d5c6f286e7f",
        "7ba80cdb-d2e5-4766-96df-932c90cf4b82"
      ]);
      expect(summary.extracted.sourceUrls).toContain("https://example.go.kr/place");
      expect(summary.extracted.sourceUrls).toContain("https://example.com/listing");
      expect(summary.extracted.imageCandidates).toContain("https://example.go.kr/images/place.jpg");
      expect(summary.extracted.imageCandidates).toContain("https://cdn.example.com/photo.webp");
      expect(summary.extracted.unresolvedCandidateLines.map((sample) => sample.text).join("\n")).toContain("Suggested action: create");
      expect(summary.extracted.blockers.map((sample) => sample.text).join("\n")).toContain("Blocker");
      expect(summary.extracted.coordinateProvenance.map((sample) => sample.text).join("\n")).toContain("coordinateProvenance");
      expect(formatAgentResearchArtifactSummary(summary)).toContain("# Agent Research Artifact Summary");
    } finally {
      await rm(researchDir, { recursive: true, force: true });
    }
  });

  it("parses CLI options", () => {
    expect(
      parseArgs(["--research-dir=/tmp/research", "--json", "--max-read-bytes=1234", "--max-samples=7", "--max-files=9"])
    ).toEqual({
      researchDir: "/tmp/research",
      json: true,
      maxReadBytes: 1234,
      maxSamples: 7,
      maxFiles: 9
    });
  });
});
