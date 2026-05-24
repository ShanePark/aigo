export function searchRelevanceScoreLabel(score: number) {
  return `검색 ${score}`;
}

export function placeQualityScoreLabel(score: number) {
  return `장소 ${score}`;
}

export function searchRelevanceScoreTitle(score: number) {
  return `현재 검색 조건 기준 관련도 ${score}점`;
}

export function placeQualityScoreTitle(score: number) {
  return `장소 자체 품질 점수 ${score}점`;
}

export function resultScoreRowLabel(searchScore: number, placeQualityScore?: number | null) {
  const parts = [searchRelevanceScoreTitle(searchScore)];
  if (placeQualityScore !== null && placeQualityScore !== undefined) {
    parts.push(placeQualityScoreTitle(placeQualityScore));
  }
  return parts.join(", ");
}
