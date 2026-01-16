import {describe, expect, test} from 'bun:test'
import {defaultAssetProcessingConfig} from '@registry/core/config'
import {ingest} from '@registry/core/ingest'
import type {
	AssetExtractor,
	Chunk,
	ResolvedContextEngineConfig
} from '@registry/core/types'

const oneChunker: ResolvedContextEngineConfig['chunker'] = (content) => {
	const text = String(content ?? '').trim()
	if (!text) {
		return []
	}
	return [
		{
			index: 0,
			content: text,
			tokenCount: text.split(/\s+/).filter(Boolean).length
		}
	]
}

function baseConfig(): {
	config: ResolvedContextEngineConfig
	upserted: Chunk[]
} {
	const upserted: Chunk[] = []
	const assetProcessing = structuredClone(defaultAssetProcessingConfig)

	const config: ResolvedContextEngineConfig = {
		embedding: {
			name: 'test-embedding',
			embed: async () => [0.1, 0.2, 0.3],
			embedImage: async () => [0.9, 0.8, 0.7]
		},
		embeddingProcessing: {concurrency: 4, batchSize: 32},
		store: {
			upsert: async (chunks) => {
				upserted.push(...chunks)
				return {documentId: chunks[0]?.documentId ?? 'test-doc-id'}
			},
			query: async () => [],
			delete: async () => {}
		},
		defaults: {chunkSize: 200, chunkOverlap: 40},
		chunker: oneChunker,
		idGenerator: () => crypto.randomUUID(),
		extractors: [],
		storage: {storeChunkContent: true, storeDocumentContent: true},
		assetProcessing
	}

	return {config, upserted}
}

describe('core routing + fallbacks', () => {
	test('PDF fallback chain: first extractor empty -> falls back to next', async () => {
		const {config, upserted} = baseConfig()
		config.embedding.embedImage = undefined // not relevant

		config.assetProcessing.pdf.textLayer.enabled = true
		config.assetProcessing.pdf.llmExtraction.enabled = true

		let firstCalled = 0
		let secondCalled = 0

		const pdfTextLayer: AssetExtractor = {
			name: 'pdf:text-layer',
			supports: ({asset}) => asset.kind === 'pdf',
			extract: async () => {
				firstCalled++
				return {texts: []}
			}
		}

		const pdfLlm: AssetExtractor = {
			name: 'pdf:llm',
			supports: ({asset}) => asset.kind === 'pdf',
			extract: async () => {
				secondCalled++
				return {texts: [{label: 'fulltext', content: 'Hello from LLM'}]}
			}
		}

		config.extractors = [pdfTextLayer, pdfLlm]

		const result = await ingest(config, {
			sourceId: 'docs:pdf-fallback',
			content: '',
			assets: [
				{
					assetId: 'pdf-1',
					kind: 'pdf',
					data: {
						kind: 'bytes',
						bytes: new Uint8Array([1, 2, 3]),
						mediaType: 'application/pdf'
					}
				}
			]
		})

		expect(firstCalled).toBe(1)
		expect(secondCalled).toBe(1)
		expect(result.warnings.length).toBe(0)

		expect(upserted.length).toBe(1)
		const first = upserted[0]
		expect(first).toBeTruthy()
		if (!first) {
			throw new Error('Expected one upserted chunk')
		}
		expect(first.metadata.extractor).toBe('pdf:llm')
		expect(first.content).toBe('Hello from LLM')
	})

	test('PDF fallback chain: first extractor returns text -> does not call later extractors', async () => {
		const {config} = baseConfig()
		config.embedding.embedImage = undefined // not relevant

		config.assetProcessing.pdf.textLayer.enabled = true
		config.assetProcessing.pdf.llmExtraction.enabled = true

		let firstCalled = 0
		let secondCalled = 0

		const pdfTextLayer: AssetExtractor = {
			name: 'pdf:text-layer',
			supports: ({asset}) => asset.kind === 'pdf',
			extract: async () => {
				firstCalled++
				return {
					texts: [
						{label: 'text-layer', content: 'Hello from text layer'}
					]
				}
			}
		}

		const pdfLlm: AssetExtractor = {
			name: 'pdf:llm',
			supports: ({asset}) => asset.kind === 'pdf',
			extract: async () => {
				secondCalled++
				return {texts: [{label: 'fulltext', content: 'Should not run'}]}
			}
		}

		config.extractors = [pdfTextLayer, pdfLlm]

		const result = await ingest(config, {
			sourceId: 'docs:pdf-no-fallback',
			content: '',
			assets: [
				{
					assetId: 'pdf-1',
					kind: 'pdf',
					data: {
						kind: 'bytes',
						bytes: new Uint8Array([1, 2, 3]),
						mediaType: 'application/pdf'
					}
				}
			]
		})

		expect(firstCalled).toBe(1)
		expect(secondCalled).toBe(0)
		expect(result.warnings.length).toBe(0)
	})

	test('Image: can produce image embedding chunk and extractor-produced text chunks', async () => {
		const {config, upserted} = baseConfig()
		config.assetProcessing.image.ocr.enabled = true

		const imageOcr: AssetExtractor = {
			name: 'image:ocr',
			supports: ({asset}) => asset.kind === 'image',
			extract: async () => ({
				texts: [{label: 'ocr', content: 'screenshot text'}]
			})
		}

		config.extractors = [imageOcr]

		const result = await ingest(config, {
			sourceId: 'docs:image-hybrid',
			content: '',
			assets: [
				{
					assetId: 'img-1',
					kind: 'image',
					data: {
						kind: 'bytes',
						bytes: new Uint8Array([1, 2, 3]),
						mediaType: 'image/png'
					},
					text: 'caption here'
				}
			]
		})

		expect(result.warnings.length).toBe(0)
		const extractors = upserted.map((c) => c.metadata.extractor).sort()
		expect(extractors).toEqual(['image:embed', 'image:ocr'].sort())
	})

	test('Disabled vs empty warnings: audio disabled emits extraction_disabled; empty output emits extraction_empty', async () => {
		// Disabled by config, no extractor => extraction_disabled
		{
			const {config} = baseConfig()
			config.embedding.embedImage = undefined
			config.assetProcessing.audio.transcription.enabled = false
			config.extractors = []

			const result = await ingest(config, {
				sourceId: 'docs:audio-disabled',
				content: '',
				assets: [
					{
						assetId: 'audio-1',
						kind: 'audio',
						data: {
							kind: 'bytes',
							bytes: new Uint8Array([1, 2, 3]),
							mediaType: 'audio/mpeg'
						}
					}
				]
			})

			expect(result.warnings.map((w) => w.code)).toEqual([
				'asset_skipped_extraction_disabled'
			])
		}

		// Enabled by config, extractor installed but returns empty => extraction_empty
		{
			const {config} = baseConfig()
			config.embedding.embedImage = undefined
			config.assetProcessing.audio.transcription.enabled = true

			const audioEx: AssetExtractor = {
				name: 'audio:transcribe',
				supports: ({asset}) => asset.kind === 'audio',
				extract: async () => ({texts: []})
			}

			config.extractors = [audioEx]

			const result = await ingest(config, {
				sourceId: 'docs:audio-empty',
				content: '',
				assets: [
					{
						assetId: 'audio-1',
						kind: 'audio',
						data: {
							kind: 'bytes',
							bytes: new Uint8Array([1, 2, 3]),
							mediaType: 'audio/mpeg'
						}
					}
				]
			})

			expect(result.warnings.map((w) => w.code)).toEqual([
				'asset_skipped_extraction_empty'
			])
		}
	})
})
