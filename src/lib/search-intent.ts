const categoryGroupIntentPatterns: Record<string, RegExp[]> = {
  kidsCafe: [/키즈\s*카페|키카|어린이\s*카페|베이비\s*카페|family\s*cafe/i],
  playroomDining: [/놀이방\s*식당|식당|맛집|고깃집|고기|뷔페|브런치|레스토랑|dining|restaurant/i],
  playground: [/놀이터|공원|숲|수목원|휴양림|물놀이터|물놀이|산책|잔디|모래놀이/i],
  stay: [/숙박|숙소|호텔|펜션|리조트|키즈\s*풀빌라|풀빌라|camping|glamping/i],
  visit: [/도서관|장난감\s*도서관|박물관|미술관|과학관|체험|문화|아쿠아리움|동물원|쇼핑|쇼핑\s*몰|백화점|아울렛|휴게소|전시/i]
};

export function shouldFallbackToAllCategoriesForQuery(query: string | undefined, categoryGroup: string) {
  if (!query?.trim() || categoryGroup === "all") return false;
  const matchedGroups = categoryIntentGroups(query);
  return matchedGroups.size === 0 || !matchedGroups.has(categoryGroup);
}

function categoryIntentGroups(query: string) {
  const matchedGroups = new Set<string>();
  for (const [group, patterns] of Object.entries(categoryGroupIntentPatterns)) {
    if (patterns.some((pattern) => pattern.test(query))) {
      matchedGroups.add(group);
    }
  }
  return matchedGroups;
}
