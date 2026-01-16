/**
 * Debug runtime registration.
 *
 * The debug server runs inside the user's app process, but interactive
 * commands (query runner, doc explorer, eval) require access to a live
 * ContextEngine (and optionally a store inspector).
 *
 * We keep this explicit: the app calls `registerUnragDebug({ engine })`
 * when UNRAG_DEBUG=true.
 */

import type {ContextEngine} from '@registry/core/context-engine'
import type {DeleteInput} from '@registry/core/types'
import type {
	DeleteChunksCommand,
	GetDocumentCommand,
	GetDocumentResult,
	ListDocumentsCommand,
	ListDocumentsResult,
	StoreStatsResult
} from '@registry/debug/types'

export type StoreInspector = {
	listDocuments: (
		args: Pick<ListDocumentsCommand, 'prefix' | 'limit' | 'offset'>
	) => Promise<Omit<ListDocumentsResult, 'type' | 'success' | 'error'>>
	getDocument: (
		args: Pick<GetDocumentCommand, 'sourceId'>
	) => Promise<Omit<GetDocumentResult, 'type' | 'success' | 'error'>>
	deleteDocument: (input: DeleteInput) => Promise<{deletedCount?: number}>
	deleteChunks: (
		args: Pick<DeleteChunksCommand, 'chunkIds'>
	) => Promise<{deletedCount?: number}>
	storeStats: () => Promise<
		Omit<StoreStatsResult, 'type' | 'success' | 'error'>
	>
}

export type UnragDebugRuntime = {
	engine: ContextEngine
	storeInspector?: StoreInspector
	registeredAt: number
}

let globalRuntime: UnragDebugRuntime | null = null

export function registerUnragDebug(args: {
	engine: ContextEngine
	storeInspector?: StoreInspector
}): void {
	globalRuntime = {
		engine: args.engine,
		storeInspector: args.storeInspector,
		registeredAt: Date.now()
	}
}

export function getUnragDebugRuntime(): UnragDebugRuntime | null {
	return globalRuntime
}

export function resetUnragDebugRuntime(): void {
	globalRuntime = null
}
