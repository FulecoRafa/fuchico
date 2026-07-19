export type FuzzyResult = {
  matched: boolean;
  score: number;
  indices: number[];
};

/**
 * Subsequence fuzzy match, VSCode-symbol-search style: every query char
 * must appear in order in the target, consecutive runs and word-boundary
 * hits score higher so e.g. "gts" ranks "Getting Started" above "Ghost".
 */
export function fuzzyMatch(query: string, target: string): FuzzyResult {
  if (!query.trim()) return { matched: true, score: 0, indices: [] };

  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const indices: number[] = [];
  let qi = 0;
  let score = 0;
  let prevIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    indices.push(ti);
    score += prevIndex === ti - 1 ? 3 : 1;
    if (ti === 0 || /\W/.test(t[ti - 1])) score += 2;
    prevIndex = ti;
    qi++;
  }

  if (qi < q.length) return { matched: false, score: 0, indices: [] };
  return { matched: true, score: score - t.length * 0.01, indices };
}
