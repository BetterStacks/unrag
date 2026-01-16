import {describe, expect, test} from 'bun:test'
import {deleteDocuments} from '@registry/core/delete'
import type {
	DeleteInput,
	ResolvedContextEngineConfig
} from '@registry/core/types'
import {createRawSqlVectorStore} from '@registry/store/raw-sql/store'
import type {Pool, PoolClient} from 'pg'

describe('core deleteDocuments', () => {
	test('throws when neither sourceId nor sourceIdPrefix is provided', async () => {
		const calls: unknown[] = []
		const config = {
			store: {delete: async (input: unknown) => calls.push(input)}
		} as unknown as ResolvedContextEngineConfig

		await expect(
			deleteDocuments(config, {} as unknown as DeleteInput)
		).rejects.toThrow(
			'Provide exactly one of "sourceId" or "sourceIdPrefix".'
		)
		expect(calls.length).toBe(0)
	})

	test('throws when both sourceId and sourceIdPrefix are provided', async () => {
		const calls: unknown[] = []
		const config = {
			store: {delete: async (input: unknown) => calls.push(input)}
		} as unknown as ResolvedContextEngineConfig

		await expect(
			deleteDocuments(config, {
				sourceId: 'a',
				sourceIdPrefix: 'b'
			} as unknown as DeleteInput)
		).rejects.toThrow(
			'Provide exactly one of "sourceId" or "sourceIdPrefix".'
		)
		expect(calls.length).toBe(0)
	})

	test('delegates to store.delete for exact sourceId', async () => {
		const calls: unknown[] = []
		const config = {
			store: {delete: async (input: unknown) => calls.push(input)}
		} as unknown as ResolvedContextEngineConfig

		await deleteDocuments(config, {sourceId: 'docs:one'})
		expect(calls).toEqual([{sourceId: 'docs:one'}])
	})

	test('delegates to store.delete for prefix deletes', async () => {
		const calls: unknown[] = []
		const config = {
			store: {delete: async (input: unknown) => calls.push(input)}
		} as unknown as ResolvedContextEngineConfig

		await deleteDocuments(config, {sourceIdPrefix: 'tenant:acme:'})
		expect(calls).toEqual([{sourceIdPrefix: 'tenant:acme:'}])
	})
})

describe('raw-sql store adapter', () => {
	test('upsert uses ON CONFLICT (source_id) and returns canonical documentId', async () => {
		const queries: Array<{text: string; values?: unknown[]}> = []
		const canonicalDocId = '11111111-1111-1111-1111-111111111111'

		const client: Pick<PoolClient, 'query' | 'release'> = {
			query: async (text: string, values?: unknown[]) => {
				queries.push({text, values})
				// Return the canonical documentId from the upsert query
				if (text.toLowerCase().includes('returning id')) {
					return {rows: [{id: canonicalDocId}]}
				}
				return {rows: []}
			},
			release: () => {}
		}

		const pool = {
			connect: async () => client
		} as unknown as Pool

		const store = createRawSqlVectorStore(pool)
		const proposedDocId = crypto.randomUUID()

		const result = await store.upsert([
			{
				id: crypto.randomUUID(),
				documentId: proposedDocId,
				sourceId: 'docs:example',
				index: 0,
				content: 'hello world',
				tokenCount: 2,
				metadata: {},
				embedding: [0.1, 0.2, 0.3],
				documentContent: 'hello world'
			}
		])

		// Verify upsert returns the canonical documentId
		expect(result).toEqual({documentId: canonicalDocId})

		const normalized = queries.map((q) => q.text.trim().toLowerCase())

		// Verify transaction structure
		const beginIdx = normalized.findIndex((t) => t === 'begin')
		expect(beginIdx).toBeGreaterThanOrEqual(0)

		// Verify upsert by source_id with RETURNING id
		const upsertIdx = normalized.findIndex(
			(t) =>
				t.includes('insert into documents') &&
				t.includes('on conflict (source_id) do update') &&
				t.includes('returning id')
		)
		expect(upsertIdx).toBeGreaterThan(beginIdx)

		// Verify chunks are deleted by document_id (not documents by source_id)
		const deleteChunksIdx = normalized.findIndex((t) =>
			t.includes('delete from chunks where document_id = $1')
		)
		expect(deleteChunksIdx).toBeGreaterThan(upsertIdx)

		// Verify the delete uses the canonical document id
		expect(queries[deleteChunksIdx]?.values).toEqual([canonicalDocId])

		// Verify chunk insert uses the canonical document id
		const insertChunkIdx = normalized.findIndex((t) =>
			t.includes('insert into chunks')
		)
		expect(insertChunkIdx).toBeGreaterThan(deleteChunksIdx)
		// Second parameter is document_id
		expect(queries[insertChunkIdx]?.values?.[1]).toBe(canonicalDocId)

		// Verify commit at the end
		const commitIdx = normalized.findIndex((t) => t === 'commit')
		expect(commitIdx).toBeGreaterThan(insertChunkIdx)
	})

	test('upsert throws when called with empty chunks array', async () => {
		const pool = {
			connect: async () =>
				({
					query: async () => ({rows: []}),
					release: () => {}
				}) as unknown as PoolClient
		} as unknown as Pool

		const store = createRawSqlVectorStore(pool)

		await expect(store.upsert([])).rejects.toThrow(
			'upsert() requires at least one chunk'
		)
	})

	test('delete({sourceIdPrefix}) uses prefix matching', async () => {
		const queries: Array<{text: string; values?: unknown[]}> = []

		const client: Pick<PoolClient, 'query' | 'release'> = {
			query: async (text: string, values?: unknown[]) => {
				queries.push({text, values})
				return {rows: []}
			},
			release: () => {}
		}

		const pool = {
			connect: async () => client
		} as unknown as Pool

		const store = createRawSqlVectorStore(pool)
		await store.delete({sourceIdPrefix: 'tenant:acme:'})

		const normalized = queries.map((q) => q.text.trim().toLowerCase())
		const likeIdx = normalized.findIndex((t) =>
			t.includes('delete from documents where source_id like $1')
		)
		expect(likeIdx).toBeGreaterThanOrEqual(0)
		expect(queries[likeIdx]?.values).toEqual(['tenant:acme:%'])
	})
})
