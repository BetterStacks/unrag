export type EvalMetricsAtK = {
  hitAtK: number;
  recallAtK: number;
  precisionAtK: number;
  mrrAtK: number;
  ndcgAtK?: number;
};

export function uniqueSourceIdsInOrder(sourceIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of sourceIds) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function computeMetricsAtK(args: {
  /** Ranked list of retrieved sourceIds (deduped internally). */
  retrievedSourceIds: string[];
  /** Set of relevant document sourceIds. */
  relevantSourceIds: string[];
  k: number;
  includeNdcg?: boolean;
}): EvalMetricsAtK {
  const k = Math.max(1, Math.floor(args.k));
  const relevant = new Set(args.relevantSourceIds);
  const ranked = uniqueSourceIdsInOrder(args.retrievedSourceIds).slice(0, k);

  let hits = 0;
  let firstRelevantRank: number | null = null;
  for (let i = 0; i < ranked.length; i++) {
    const sid = ranked[i]!;
    if (relevant.has(sid)) {
      hits++;
      if (firstRelevantRank === null) firstRelevantRank = i + 1; // 1-indexed
    }
  }

  const hitAtK = hits > 0 ? 1 : 0;
  const recallAtK =
    args.relevantSourceIds.length === 0 ? 0 : hits / args.relevantSourceIds.length;
  const precisionAtK = hits / k;
  const mrrAtK = firstRelevantRank ? 1 / firstRelevantRank : 0;

  const out: EvalMetricsAtK = { hitAtK, recallAtK, precisionAtK, mrrAtK };

  if (args.includeNdcg) {
    out.ndcgAtK = computeNdcgAtK({ rankedSourceIds: ranked, relevant, k });
  }

  return out;
}

function computeNdcgAtK(args: {
  rankedSourceIds: string[];
  relevant: Set<string>;
  k: number;
}): number {
  const k = Math.max(1, Math.floor(args.k));
  const ranked = args.rankedSourceIds.slice(0, k);

  // Binary relevance DCG
  let dcg = 0;
  for (let i = 0; i < ranked.length; i++) {
    const rel = args.relevant.has(ranked[i]!) ? 1 : 0;
    if (rel === 0) continue;
    // rank position is (i+1); discount uses log2(i+2)
    dcg += rel / Math.log2(i + 2);
  }

  // Ideal DCG: all relevant docs at the top (binary)
  const idealRelevantCount = Math.min(args.relevant.size, k);
  let idcg = 0;
  for (let i = 0; i < idealRelevantCount; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  if (idcg === 0) return 0;
  return dcg / idcg;
}

