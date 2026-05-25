"use client";

import { useId, useState } from "react";
import { Gauge, X } from "lucide-react";
import type { CSSProperties } from "react";

import type { ReasonMetadata } from "@/lib/reasons";
import type { ScoreBreakdown } from "@/lib/scoring";

type PlaceScoreDialogProps = {
  breakdown: ScoreBreakdown;
  rationale: string | null;
  reasons: ReasonMetadata[];
  score: number;
  storedPlaceScore: number | null;
  updatedAt: string | null;
};

const componentLabels: Array<[keyof ScoreBreakdown, string]> = [
  ["placeQuality", "장소 자체 평가"],
  ["externalEvidence", "출처 근거"],
  ["preferences", "가족 편의시설"],
  ["visitFit", "방문 경험 신호"],
  ["confidence", "데이터 신뢰도"]
];

export function PlaceScoreDialog({ breakdown, rationale, reasons, score, storedPlaceScore, updatedAt }: PlaceScoreDialogProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const scoreStyle = { "--score-value": `${score * 3.6}deg` } as CSSProperties;

  return (
    <>
      <button
        className={`detail-score-button ${scoreTone(score)}`}
        style={scoreStyle}
        type="button"
        aria-label={`장소 점수 ${score}점 설명 보기`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="detail-score-ring">
          <strong>{score}</strong>
        </span>
      </button>

      {open ? (
        <div className="score-dialog-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            aria-labelledby={titleId}
            aria-modal="true"
            className="score-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="score-dialog-head">
              <div>
                <p>
                  <Gauge size={16} aria-hidden="true" />
                  장소 자체 점수
                </p>
                <h2 id={titleId}>{score}점</h2>
              </div>
              <button className="score-dialog-close" type="button" aria-label="점수 설명 닫기" onClick={() => setOpen(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <p className="score-dialog-copy">
              검색어, 거리, 필터 조건을 뺀 장소 자체 평가입니다. 저장된 장소 평가, 출처/외부근거, 가족 편의시설, 방문 부담과 데이터 신뢰도를
              합산합니다.
            </p>

            <dl className="score-dialog-summary">
              <div>
                <dt>등록 평가</dt>
                <dd>{storedPlaceScore === null ? "미평가" : `${storedPlaceScore}/10`}</dd>
              </div>
              <div>
                <dt>기준점</dt>
                <dd>{breakdown.baseline}</dd>
              </div>
              <div>
                <dt>마지막 산정</dt>
                <dd>{updatedAt ? formatDate(updatedAt) : "미확인"}</dd>
              </div>
            </dl>

            {rationale ? <p className="score-dialog-rationale">{rationale}</p> : null}

            <div className="score-dialog-components" aria-label="점수 구성">
              {componentLabels.map(([key, label]) => (
                <div className="score-component-row" key={key}>
                  <span>{label}</span>
                  <strong>{signedNumber(breakdown[key])}</strong>
                </div>
              ))}
            </div>

            {reasons.length > 0 ? (
              <div className="score-dialog-reasons" aria-label="주요 산정 이유">
                {reasons.slice(0, 8).map((reason) => (
                  <span className={`score-reason-chip ${reason.tone}`} key={reason.code}>
                    {reason.labelKo}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function scoreTone(score: number) {
  if (score >= 65) return "score-high";
  if (score >= 58) return "score-good";
  if (score >= 50) return "score-mid";
  return "score-low";
}

function signedNumber(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}
