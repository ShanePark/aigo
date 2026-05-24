const categoryGroupIntentPatterns: Record<string, RegExp[]> = {
  kidsCafe: [/키즈\s*카페|키카|어린이\s*카페|베이비\s*카페|family\s*cafe/i],
  playroomDining: [/놀이방\s*식당|식당|맛집|고깃집|고기|뷔페|브런치|레스토랑|dining|restaurant/i],
  playground: [/놀이터|어린이\s*공원|물놀이터|물놀이|모래놀이|미끄럼틀|그네|시소/i],
  shopping: [/쇼핑|쇼핑\s*(몰|센터)|쇼핑몰|쇼핑센터|백화점|아울렛|복합\s*쇼핑|롯데\s*몰|롯데몰|스타필드|shopping|department\s*store|outlet/i],
  stay: [/숙박|숙소|호텔|펜션|리조트|키즈\s*풀빌라|풀빌라|camping|glamping/i],
  toyStore: [/장난감\s*(가게|매장|샵|숍)|완구|토이저러스|토이플러스|레고\s*스토어/i],
  visit: [/도서관|장난감\s*도서관|박물관|미술관|과학관|체험|문화|아쿠아리움|동물원|휴게소|전시/i]
};

export function shouldFallbackToAllCategoriesForQuery(query: string | undefined, categoryGroup: string | string[]) {
  const activeGroups = Array.isArray(categoryGroup) ? categoryGroup : [categoryGroup];
  const selectedGroups = activeGroups.filter((group) => group !== "all");
  if (!query?.trim() || selectedGroups.length === 0) return false;
  const matchedGroups = categoryIntentGroups(query);
  return matchedGroups.size === 0 || selectedGroups.every((group) => !matchedGroups.has(group));
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
