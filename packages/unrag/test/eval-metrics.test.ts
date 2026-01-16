import {describe, expect, test} from 'bun:test'
import {computeMetricsAtK, uniqueSourceIdsInOrder} from '@registry/eval/metrics'

describe('eval metrics', () => {
	test('uniqueSourceIdsInOrder de-dupes while preserving first occurrence', () => {
		const out = uniqueSourceIdsInOrder(['a', 'b', 'a', 'c', 'b'])
		expect(out).toEqual(['a', 'b', 'c'])
	})

	test('computes hit/precision/recall/mrr correctly', () => {
		const m = computeMetricsAtK({
			retrievedSourceIds: ['x', 'a', 'b', 'c'],
			relevantSourceIds: ['a', 'c'],
			k: 3
		})

		// top3 = [x,a,b] -> hits=1
		expect(m.hitAtK).toBe(1)
		expect(m.recallAtK).toBeCloseTo(1 / 2, 6)
		expect(m.precisionAtK).toBeCloseTo(1 / 3, 6)
		expect(m.mrrAtK).toBeCloseTo(1 / 2, 6) // first relevant at rank 2
	})

	test('nDCG is 0 when no relevant docs exist', () => {
		const m = computeMetricsAtK({
			retrievedSourceIds: ['a', 'b'],
			relevantSourceIds: [],
			k: 2,
			includeNdcg: true
		})
		expect(m.ndcgAtK).toBe(0)
	})
})
