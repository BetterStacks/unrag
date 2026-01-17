import type {DeleteInput, IngestInput, IngestResult} from '@unrag/core/types'

/**
 * A single event emitted by a connector stream.
 *
 * Connectors should emit only these event shapes so a generic runner can
 * consume them and apply them to the Unrag engine.
 *
 * @template TCheckpoint JSON-serializable checkpoint payload used to resume syncs.
 */
export type ConnectorEvent<TCheckpoint = unknown> =
	| {
			/**
			 * Upsert a document into Unrag (chunk → embed → store).
			 */
			type: 'upsert'
			input: IngestInput
	  }
	| {
			/**
			 * Delete documents by exact sourceId or by sourceId prefix.
			 */
			type: 'delete'
			input: DeleteInput
	  }
	| {
			/**
			 * Optional progress signal from the connector.
			 */
			type: 'progress'
			message?: string
			current?: number
			total?: number
			sourceId?: string
			entityId?: string
			data?: Record<string, unknown>
	  }
	| {
			/**
			 * Non-fatal warning emitted by the connector.
			 * These do not halt processing unless your code chooses to.
			 */
			type: 'warning'
			code: string
			message: string
			data?: Record<string, unknown>
	  }
	| {
			/**
			 * Opaque, JSON-serializable checkpoint for resuming a long-running sync.
			 */
			type: 'checkpoint'
			checkpoint: TCheckpoint
	  }

/**
 * A connector stream produces a sequence of connector events.
 *
 * Async generators are the recommended implementation because they allow
 * incremental progress and checkpointing (serverless-friendly).
 */
export type ConnectorStream<TCheckpoint = unknown> = AsyncIterable<
	ConnectorEvent<TCheckpoint>
>

/**
 * Minimal engine surface required by the connector runner.
 * This is intentionally structural (not tied to the ContextEngine class),
 * so it can be used in tests or with compatible engine-like objects.
 */
export type ConnectorRunnerEngine = {
	ingest: (input: IngestInput) => Promise<IngestResult>
	delete: (input: DeleteInput) => Promise<void>
}

/**
 * Options for running a connector stream.
 */
export type RunConnectorStreamOptions<TCheckpoint = unknown> = {
	engine: ConnectorRunnerEngine
	stream: ConnectorStream<TCheckpoint>
	/**
	 * Called for every event emitted by the connector (including checkpoints).
	 * Use this for logging/metrics/UI.
	 */
	onEvent?: (event: ConnectorEvent<TCheckpoint>) => void | Promise<void>
	/**
	 * Called when a checkpoint event is emitted. Recommended for persisting
	 * resumable cursor state to a DB/KV.
	 */
	onCheckpoint?: (checkpoint: TCheckpoint) => void | Promise<void>
	/**
	 * Optional abort signal to stop consumption early.
	 */
	signal?: AbortSignal
}

/**
 * Summary of a connector run.
 */
export type RunConnectorStreamResult<TCheckpoint = unknown> = {
	upserts: number
	deletes: number
	warnings: number
	lastCheckpoint?: TCheckpoint
}

/**
 * Consume a connector stream and apply its events to the Unrag engine.
 *
 * This runner is intentionally sequential to preserve connector ordering
 * semantics and avoid overwhelming external services with concurrency.
 */
export const runConnectorStream = async <TCheckpoint = unknown>(
	options: RunConnectorStreamOptions<TCheckpoint>
): Promise<RunConnectorStreamResult<TCheckpoint>> => {
	let upserts = 0
	let deletes = 0
	let warnings = 0
	let lastCheckpoint: TCheckpoint | undefined

	const throwIfAborted = () => {
		if (options.signal?.aborted) {
			throw new Error('Connector stream aborted')
		}
	}

	for await (const event of options.stream) {
		throwIfAborted()

		if (options.onEvent) {
			await options.onEvent(event)
		}

		if (event.type === 'checkpoint') {
			lastCheckpoint = event.checkpoint
			if (options.onCheckpoint) {
				await options.onCheckpoint(event.checkpoint)
			}
			continue
		}

		if (event.type === 'warning') {
			warnings += 1
			continue
		}

		if (event.type === 'upsert') {
			await options.engine.ingest(event.input)
			upserts += 1
			continue
		}

		if (event.type === 'delete') {
			await options.engine.delete(event.input)
			deletes += 1
		}
	}

	return {upserts, deletes, warnings, lastCheckpoint}
}
