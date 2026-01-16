import {describe, expect, test} from 'bun:test'
import {rerank} from '@registry/core/rerank'
import type {
	Reranker,
	RerankCandidate,
	ResolvedContextEngineConfig
} from '@registry/core/types'

/**
 * Creates a fake reranker that reverses the order of documents.
 */
const createReverseReranker = (): Reranker => ({
	name: 'test-reverse',
	rerank: async ({documents}) => {
		const order = documents.map((_, i) => documents.length - 1 - i)
		const scores = order.map((_, i) => 1 - i * 0.1)
		return {order, scores, model: 'reverse-v1'}
	}
})

/**
 * Creates a fake reranker that sorts by document length (shortest first).
 */
const createLengthReranker = (): Reranker => ({
	name: 'test-length',
	rerank: async ({documents}) => {
		const indexed = documents.map((d, i) => ({len: d.length, i}))
		indexed.sort((a, b) => a.len - b.len)
		const order = indexed.map((x) => x.i)
		const scores = indexed.map((x) => 1 / (x.len + 1))
		return {order, scores, model: 'length-v1'}
	}
})

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
		score: 1 - i * 0.1 // Original retrieval score
	}))

/**
 * Creates a minimal resolved config with a reranker.
 */
const createConfig = (reranker?: Reranker): ResolvedContextEngineConfig =>
	({
		reranker,
		// Other fields are not used by rerank(), but TypeScript needs them
		embedding: {} as any,
		store: {} as any,
		defaults: {chunkSize: 200, chunkOverlap: 40},
		chunker: () => [],
		idGenerator: () => crypto.randomUUID(),
		extractors: [],
		storage: {storeChunkContent: true, storeDocumentContent: true},
		assetProcessing: {} as any,
		embeddingProcessing: {concurrency: 4, batchSize: 32}
	}) as ResolvedContextEngineConfig

describe('core rerank - basic functionality', () => {
	test('rerank changes the order of candidates', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['first', 'second', 'third'])

		const result = await rerank(config, {
			query: 'test query',
			candidates
		})

		// Reverse reranker puts last first
		expect(result.chunks.length).toBe(3)
		expect(result.chunks[0]!.id).toBe('chunk-2')
		expect(result.chunks[1]!.id).toBe('chunk-1')
		expect(result.chunks[2]!.id).toBe('chunk-0')
	})

	test('rerank respects topK parameter', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a', 'b', 'c', 'd', 'e'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			topK: 2
		})

		expect(result.chunks.length).toBe(2)
		expect(result.chunks[0]!.id).toBe('chunk-4')
		expect(result.chunks[1]!.id).toBe('chunk-3')
	})

	test('rerank returns all candidates when topK is not specified', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a', 'b', 'c'])

		const result = await rerank(config, {
			query: 'test query',
			candidates
		})

		expect(result.chunks.length).toBe(3)
	})

	test('rerank clamps topK to candidates length', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a', 'b'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			topK: 100 // More than available
		})

		expect(result.chunks.length).toBe(2)
	})

	test('rerank clamps topK to minimum of 1', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a', 'b', 'c'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			topK: 0 // Should become 1
		})

		expect(result.chunks.length).toBe(1)
	})

	test('rerank returns correct meta information', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a'])

		const result = await rerank(config, {
			query: 'test query',
			candidates
		})

		expect(result.meta.rerankerName).toBe('test-reverse')
		expect(result.meta.model).toBe('reverse-v1')
	})

	test('rerank returns duration information', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a'])

		const result = await rerank(config, {
			query: 'test query',
			candidates
		})

		expect(result.durations.rerankMs).toBeGreaterThanOrEqual(0)
		expect(result.durations.totalMs).toBeGreaterThanOrEqual(0)
		expect(result.durations.totalMs).toBeGreaterThanOrEqual(
			result.durations.rerankMs
		)
	})

	test('rerank returns full ranking array', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a', 'b', 'c'])

		const result = await rerank(config, {
			query: 'test query',
			candidates,
			topK: 2
		})

		// ranking should have all items, not just topK
		expect(result.ranking.length).toBe(3)
		expect(result.ranking[0]!.index).toBe(2) // Reversed order
		expect(result.ranking[1]!.index).toBe(1)
		expect(result.ranking[2]!.index).toBe(0)
	})

	test('rerank includes rerank scores in ranking', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates(['a', 'b'])

		const result = await rerank(config, {
			query: 'test query',
			candidates
		})

		expect(result.ranking[0]!.rerankScore).toBeDefined()
		expect(typeof result.ranking[0]!.rerankScore).toBe('number')
	})

	test('rerank works with length-based reranker', async () => {
		const reranker = createLengthReranker()
		const config = createConfig(reranker)
		const candidates = createCandidates([
			'long content here',
			'short',
			'medium text'
		])

		const result = await rerank(config, {
			query: 'test query',
			candidates
		})

		// Shortest first
		expect(result.chunks[0]!.content).toBe('short')
		expect(result.chunks[1]!.content).toBe('medium text')
		expect(result.chunks[2]!.content).toBe('long content here')
	})

	test('rerank returns empty result for empty candidates', async () => {
		const reranker = createReverseReranker()
		const config = createConfig(reranker)

		const result = await rerank(config, {
			query: 'test query',
			candidates: []
		})

		expect(result.chunks.length).toBe(0)
		expect(result.ranking.length).toBe(0)
		expect(result.warnings.length).toBeGreaterThan(0)
	})
})
