import {describe, expect, test} from 'bun:test'
import {rerank} from '@registry/core/rerank'
import type {
	RerankCandidate,
	ResolvedContextEngineConfig
} from '@registry/core/types'

/**
 * Creates test candidates.
 */
const createCandidates = (texts: string[]): RerankCandidate[] =>
	texts.map((content, i) => ({
		id: `chunk-${i}`,
		documentId: `doc-${i}`,
		sourceId: `source-${i}`,
		index: i,
		content,
		tokenCount: content.split(' ').length,
		metadata: {},
		score: 1 - i * 0.1
	}))

/**
 * Creates a minimal resolved config without a reranker.
 */
const createConfigWithoutReranker = (): ResolvedContextEngineConfig =>
	({
		reranker: undefined,
		embedding: {} as unknown as ResolvedContextEngineConfig['embedding'],
		store: {} as unknown as ResolvedContextEngineConfig['store'],
		defaults: {chunkSize: 200, chunkOverlap: 40},
		chunker: () => [],
		idGenerator: () => crypto.randomUUID(),
		extractors: [],
		storage: {storeChunkContent: true, storeDocumentContent: true},
		assetProcessing:
			{} as unknown as ResolvedContextEngineConfig['assetProcessing'],
		embeddingProcessing: {concurrency: 4, batchSize: 32}
	}) as ResolvedContextEngineConfig

describe('core rerank - missing reranker handling', () => {
	test('throws by default when reranker is not configured', async () => {
		const config = createConfigWithoutReranker()
		const candidates = createCandidates(['a', 'b', 'c'])

		await expect(
			rerank(config, {
				query: 'test query',
				candidates
			})
		).rejects.toThrow(/Reranker not configured/)
	})

	test('throws with helpful error message when reranker missing', async () => {
		const config = createConfigWithoutReranker()
		const candidates = createCandidates(['a'])

		try {
			await rerank(config, {query: 'test', candidates})
			expect.unreachable('Should have thrown')
		} catch (err) {
			expect((err as Error).message).toContain(
				'unrag add battery reranker'
			)
			expect((err as Error).message).toContain('onMissingReranker')
		}
	})

	test("skips reranking when onMissingReranker is 'skip'", async () => {
		const config = createConfigWithoutReranker()
		const candidates = createCandidates(['first', 'second', 'third'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			onMissingReranker: 'skip'
		})

		// Should return original order
		expect(result.chunks.length).toBe(3)
		expect(result.chunks[0]?.id).toBe('chunk-0')
		expect(result.chunks[1]?.id).toBe('chunk-1')
		expect(result.chunks[2]?.id).toBe('chunk-2')
	})

	test('returns warning when skipping due to missing reranker', async () => {
		const config = createConfigWithoutReranker()
		const candidates = createCandidates(['a', 'b'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			onMissingReranker: 'skip'
		})

		expect(result.warnings.length).toBeGreaterThan(0)
		expect(result.warnings.some((w) => w.includes('not configured'))).toBe(
			true
		)
	})

	test('respects topK when skipping due to missing reranker', async () => {
		const config = createConfigWithoutReranker()
		const candidates = createCandidates(['a', 'b', 'c', 'd', 'e'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			topK: 2,
			onMissingReranker: 'skip'
		})

		expect(result.chunks.length).toBe(2)
		expect(result.chunks[0]?.id).toBe('chunk-0')
		expect(result.chunks[1]?.id).toBe('chunk-1')
	})

	test("sets rerankerName to 'none' when skipping", async () => {
		const config = createConfigWithoutReranker()
		const candidates = createCandidates(['a'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			onMissingReranker: 'skip'
		})

		expect(result.meta.rerankerName).toBe('none')
		expect(result.meta.model).toBeUndefined()
	})

	test('sets rerankMs to 0 when skipping', async () => {
		const config = createConfigWithoutReranker()
		const candidates = createCandidates(['a'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			onMissingReranker: 'skip'
		})

		expect(result.durations.rerankMs).toBe(0)
	})
})
