import {describe, expect, test} from 'bun:test'
import {runConnectorStream} from '@registry/core/connectors'

describe('connector runner', () => {
	test('applies upserts/deletes and tracks checkpoints', async () => {
		const ingests: unknown[] = []
		const deletes: unknown[] = []
		const events: unknown[] = []
		const checkpoints: unknown[] = []

		const engine = {
			ingest: async (input: {
				sourceId: string
				content: string
				metadata?: Record<string, unknown>
			}) => {
				ingests.push(input)
				return {
					documentId: 'doc-1',
					chunkCount: 1,
					embeddingModel: 'test',
					warnings: [],
					durations: {
						totalMs: 0,
						chunkingMs: 0,
						embeddingMs: 0,
						storageMs: 0
					}
				}
			},
			delete: async (input: {sourceId: string}) => {
				deletes.push(input)
			}
		}

		async function* stream() {
			yield {type: 'upsert', input: {sourceId: 'doc:a', content: 'hello'}}
			yield {type: 'checkpoint', checkpoint: {index: 1}}
			yield {type: 'warning', code: 'warn', message: 'note'}
			yield {type: 'delete', input: {sourceId: 'doc:a'}}
		}

		const result = await runConnectorStream({
			engine,
			stream: stream(),
			onEvent: (event) => events.push(event),
			onCheckpoint: (checkpoint) => checkpoints.push(checkpoint)
		})

		expect(ingests.length).toBe(1)
		expect(deletes.length).toBe(1)
		expect(events.length).toBe(4)
		expect(checkpoints).toEqual([{index: 1}])
		expect(result).toEqual({
			upserts: 1,
			deletes: 1,
			warnings: 1,
			lastCheckpoint: {index: 1}
		})
	})
})
