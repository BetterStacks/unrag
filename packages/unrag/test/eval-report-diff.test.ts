import {describe, expect, test} from 'bun:test'
import {diffEvalReports, type EvalReportV1} from '@registry/eval/report'

function reportWithRecall(recallAtK: number): EvalReportV1 {
	return {
		version: '1',
		createdAt: new Date().toISOString(),
		dataset: {id: 'ds', version: '1'},
		config: {
			mode: 'retrieve',
			topK: 10,
			scopePrefix: 'eval:ds:',
			ingest: false,
			cleanup: 'none',
			includeNdcg: false
		},
		engine: {},
		results: {
			queries: [
				{
					id: 'q1',
					query: 'x',
					topK: 10,
					scopePrefix: 'eval:ds:',
					relevant: {sourceIds: ['eval:ds:doc:a']},
					retrieved: {
						sourceIds: ['eval:ds:doc:a'],
						metrics: {
							hitAtK: 1,
							recallAtK,
							precisionAtK: recallAtK / 10,
							mrrAtK: 1
						},
						durationsMs: {
							embeddingMs: 1,
							retrievalMs: 1,
							totalMs: 2
						}
					}
				}
			],
			aggregates: {
				retrieved: {
					mean: {
						hitAtK: 1,
						recallAtK,
						precisionAtK: recallAtK / 10,
						mrrAtK: 1
					},
					median: {
						hitAtK: 1,
						recallAtK,
						precisionAtK: recallAtK / 10,
						mrrAtK: 1
					}
				}
			},
			timings: {
				embeddingMs: {p50: 1, p95: 1},
				retrievalMs: {p50: 1, p95: 1},
				retrieveTotalMs: {p50: 2, p95: 2},
				totalMs: {p50: 2, p95: 2}
			}
		}
	}
}

describe('eval report diff', () => {
	test('diff computes deltas', () => {
		const baseline = reportWithRecall(0.5)
		const candidate = reportWithRecall(0.8)

		const diff = diffEvalReports({
			baseline,
			candidate,
			baselinePath: '/baseline/report.json',
			candidatePath: '/candidate/report.json'
		})

		expect(diff.deltas.retrieved.recallAtK).toBeCloseTo(0.3, 6)
		expect(diff.worstRegressions.length).toBeGreaterThan(0)
	})
})
