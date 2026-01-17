import {isFullPage} from '@notionhq/client'
import type {
	GetPageResponse,
	ListBlockChildrenResponse,
	RichTextItemResponse
} from '@notionhq/client/build/src/api-endpoints'
import {
	type NotionClient,
	createNotionClient
} from '@registry/connectors/notion/client'
import {
	normalizeNotionPageId32,
	toUuidHyphenated
} from '@registry/connectors/notion/ids'
import {
	type NotionBlock,
	type NotionBlockNode,
	extractNotionAssets,
	renderNotionBlocksToText
} from '@registry/connectors/notion/render'
import type {
	BuildNotionPageIngestInputArgs,
	NotionCheckpoint,
	NotionPageDocument,
	StreamNotionPagesInput
} from '@registry/connectors/notion/types'
import type {Metadata} from '@registry/core'
import type {ConnectorStream} from '@registry/core/connectors'

const joinPrefix = (prefix: string | undefined, rest: string) => {
	const p = (prefix ?? '').trim()
	if (!p) {
		return rest
	}
	return p.endsWith(':') ? p + rest : `${p}:${rest}`
}

export function buildNotionPageIngestInput(
	args: BuildNotionPageIngestInputArgs
) {
	const sourceId = joinPrefix(
		args.sourceIdPrefix,
		`notion:page:${args.pageId}`
	)

	return {
		sourceId,
		content: args.content,
		metadata: args.metadata ?? {},
		assets: args.assets ?? []
	}
}

const richTextToText = (richText: RichTextItemResponse[] | undefined): string =>
	(richText ?? []).map((t) => t.plain_text).join('')

const getNotionPageTitle = (page: GetPageResponse): string => {
	if (!isFullPage(page)) {
		return ''
	}
	const props = page.properties
	for (const key of Object.keys(props)) {
		const p = props[key]
		if (p.type === 'title') {
			return richTextToText(p.title)
		}
	}
	return ''
}

async function listAllBlockChildren(
	notion: NotionClient,
	blockId: string
): Promise<NotionBlock[]> {
	const blocks: NotionBlock[] = []
	let cursor: string | undefined = undefined

	while (true) {
		const res: ListBlockChildrenResponse =
			await notion.blocks.children.list({
				block_id: blockId,
				start_cursor: cursor,
				page_size: 100
			})

		blocks.push(...(res.results as NotionBlock[]))
		if (!res.has_more) {
			break
		}
		cursor = res.next_cursor ?? undefined
		if (!cursor) {
			break
		}
	}

	return blocks
}

async function buildBlockTree(
	notion: NotionClient,
	rootBlockId: string,
	depth: number,
	maxDepth: number
): Promise<NotionBlockNode[]> {
	const children = await listAllBlockChildren(notion, rootBlockId)
	const nodes: NotionBlockNode[] = []

	for (const block of children) {
		let grandChildren: NotionBlockNode[] = []
		if (block.has_children && depth < maxDepth) {
			grandChildren = await buildBlockTree(
				notion,
				block.id,
				depth + 1,
				maxDepth
			)
		}
		nodes.push({block, children: grandChildren})
	}

	return nodes
}

export async function loadNotionPageDocument(args: {
	notion: NotionClient
	pageIdOrUrl: string
	sourceIdPrefix?: string
	maxDepth?: number
}): Promise<NotionPageDocument> {
	const pageId = normalizeNotionPageId32(args.pageIdOrUrl)
	const apiId = toUuidHyphenated(pageId)

	const page: GetPageResponse = await args.notion.pages.retrieve({
		page_id: apiId
	})
	const title = getNotionPageTitle(page)
	const url = isFullPage(page) ? page.url : ''
	const lastEditedTime = isFullPage(page) ? page.last_edited_time : ''

	const tree = await buildBlockTree(args.notion, apiId, 0, args.maxDepth ?? 4)
	const body = renderNotionBlocksToText(tree)
	const content = [title.trim(), body.trim()].filter(Boolean).join('\n\n')
	const assets = extractNotionAssets(tree)

	const metadata: Metadata = {
		connector: 'notion',
		kind: 'page',
		pageId,
		url,
		title,
		lastEditedTime
	}

	const ingest = buildNotionPageIngestInput({
		pageId,
		content,
		assets,
		metadata,
		sourceIdPrefix: args.sourceIdPrefix
	})

	return {
		sourceId: ingest.sourceId,
		content: ingest.content,
		metadata: ingest.metadata ?? {},
		assets: ingest.assets ?? []
	}
}

const isNotFound = (err: unknown): boolean => {
	if (typeof err !== 'object' || err === null) {
		return false
	}
	const e = err as Record<string, unknown>
	const status = Number(e.status ?? e.statusCode ?? e.code ?? 0)
	if (status === 404) {
		return true
	}
	const msg = String(e.message ?? '')
	return msg.toLowerCase().includes('could not find')
}

const asMessage = (err: unknown): string => {
	if (err instanceof Error) {
		return err.message
	}
	try {
		return typeof err === 'string' ? err : JSON.stringify(err)
	} catch {
		return String(err)
	}
}

/**
 * Stream Notion pages as connector events.
 *
 * This yields `upsert` and `delete` events that can be applied to an Unrag engine
 * via `engine.runConnectorStream(...)`. Progress and warnings are emitted as
 * separate events so callers can attach logging and checkpointing.
 */
export async function* streamPages(
	input: StreamNotionPagesInput
): ConnectorStream<NotionCheckpoint> {
	const deleteOnNotFound = input.deleteOnNotFound ?? false
	const pageIds = Array.isArray(input.pageIds) ? input.pageIds : []
	const startIndex = Math.max(0, input.checkpoint?.index ?? 0)
	const notion = createNotionClient({token: input.token})

	for (let i = startIndex; i < pageIds.length; i++) {
		const rawId = pageIds[i]
		const rawIdStr = String(rawId ?? '').trim()
		if (!rawIdStr) {
			yield {
				type: 'warning',
				code: 'page_id_missing',
				message: 'Skipping Notion page because page id is missing.',
				data: {index: i}
			}
			yield {type: 'checkpoint', checkpoint: {index: i + 1}}
			continue
		}

		let pageId: string
		try {
			pageId = normalizeNotionPageId32(rawIdStr)
		} catch (err) {
			yield {
				type: 'warning',
				code: 'page_id_invalid',
				message:
					err instanceof Error
						? err.message
						: 'Invalid Notion page id.',
				data: {rawId: rawIdStr, index: i}
			}
			yield {type: 'checkpoint', checkpoint: {index: i + 1}}
			continue
		}

		const sourceId = joinPrefix(
			input.sourceIdPrefix,
			`notion:page:${pageId}`
		)

		yield {
			type: 'progress',
			message: 'page:start',
			current: i + 1,
			total: pageIds.length,
			sourceId,
			entityId: pageId
		}

		try {
			const doc = await loadNotionPageDocument({
				notion,
				pageIdOrUrl: pageId,
				sourceIdPrefix: input.sourceIdPrefix,
				maxDepth: input.maxDepth
			})

			yield {
				type: 'upsert',
				input: {
					sourceId: doc.sourceId,
					content: doc.content,
					assets: doc.assets,
					metadata: doc.metadata
				}
			}

			yield {
				type: 'progress',
				message: 'page:success',
				current: i + 1,
				total: pageIds.length,
				sourceId,
				entityId: pageId
			}
		} catch (err) {
			if (isNotFound(err)) {
				yield {
					type: 'warning',
					code: 'page_not_found',
					message: 'Notion page not found or inaccessible.',
					data: {pageId, sourceId}
				}

				if (deleteOnNotFound) {
					yield {type: 'delete', input: {sourceId}}
				}
			} else {
				yield {
					type: 'warning',
					code: 'page_error',
					message: asMessage(err),
					data: {pageId, sourceId}
				}
			}
		}

		yield {
			type: 'checkpoint',
			checkpoint: {
				index: i + 1,
				pageId
			}
		}
	}
}

/**
 * Exported connector surface for Notion.
 *
 * This keeps connector-related functionality namespaced and future-proof.
 */
export const notionConnector = {
	streamPages
}
