import {
	GRAPH_BASE_URL,
	graphDownload,
	graphDownloadFromPath,
	graphFetchJson
} from '@registry/connectors/onedrive/client'
import type {
	OneDriveAuth,
	OneDriveCheckpoint,
	OneDriveDriveSelector,
	OneDriveFolderSelector,
	StreamOneDriveFilesInput,
	StreamOneDriveFolderInput
} from '@registry/connectors/onedrive/types'
import type {ConnectorStream} from '@registry/core/connectors'
import type {AssetInput, Metadata} from '@registry/core/types'

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024 // 15MB

const joinPrefix = (prefix: string | undefined, rest: string) => {
	const p = (prefix ?? '').trim()
	if (!p) {
		return rest
	}
	return p.endsWith(':') ? p + rest : `${p}:${rest}`
}

const buildSourceId = (
	prefix: string | undefined,
	driveId: string,
	itemId: string
) => joinPrefix(prefix, `onedrive:item:${driveId}:${itemId}`)

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

const isTextLike = (mediaType: string | undefined) => {
	const mt = String(mediaType ?? '')
		.trim()
		.toLowerCase()
	if (!mt) {
		return false
	}
	return (
		mt.startsWith('text/') ||
		mt === 'application/json' ||
		mt === 'application/xml' ||
		mt === 'text/csv'
	)
}

const assetKindFromMediaType = (
	mediaType: string | undefined
): AssetInput['kind'] => {
	const mt = String(mediaType ?? '')
		.trim()
		.toLowerCase()
	if (mt === 'application/pdf') {
		return 'pdf'
	}
	if (mt.startsWith('image/')) {
		return 'image'
	}
	if (mt.startsWith('audio/')) {
		return 'audio'
	}
	if (mt.startsWith('video/')) {
		return 'video'
	}
	return 'file'
}

const isNotFound = (err: unknown): boolean => {
	if (typeof err !== 'object' || err === null) {
		return false
	}
	const e = err as Record<string, unknown>
	const status = Number(e.status ?? e.statusCode ?? 0)
	if (status === 404) {
		return true
	}
	const msg = String(e.message ?? '')
	return msg.toLowerCase().includes('itemnotfound')
}

const driveBasePath = (drive: OneDriveDriveSelector) => {
	if (drive.kind === 'me') {
		return 'me/drive'
	}
	if (drive.kind === 'user') {
		return `users/${encodeURIComponent(drive.userId)}/drive`
	}
	return `drives/${encodeURIComponent(drive.driveId)}`
}

type GraphDriveItem = {
	id?: string
	name?: string
	size?: number
	file?: {mimeType?: string}
	folder?: {childCount?: number}
	deleted?: Record<string, unknown>
	parentReference?: {driveId?: string; id?: string}
	webUrl?: string
	lastModifiedDateTime?: string
	'@microsoft.graph.downloadUrl'?: string
}

const resolveDriveId = async (
	auth: OneDriveAuth,
	drive: OneDriveDriveSelector
) => {
	if (drive.kind === 'drive') {
		return drive.driveId
	}
	const base = driveBasePath(drive)
	const data = await graphFetchJson<{id?: string}>({
		auth,
		url: `${GRAPH_BASE_URL}/${base}?$select=id`
	})
	const id = String(data?.id ?? '').trim()
	if (!id) {
		throw new Error('OneDrive drive id not found')
	}
	return id
}

const resolveFolderId = async (args: {
	auth: OneDriveAuth
	drive: OneDriveDriveSelector
	folder?: OneDriveFolderSelector
}) => {
	const base = driveBasePath(args.drive)
	if (args.folder?.id) {
		return String(args.folder.id).trim()
	}
	if (args.folder?.path) {
		const path = String(args.folder.path).trim().replace(/^\//, '')
		const data = await graphFetchJson<GraphDriveItem>({
			auth: args.auth,
			url: `${GRAPH_BASE_URL}/${base}/root:/${encodeURIComponent(path)}?$select=id`
		})
		const id = String(data?.id ?? '').trim()
		if (!id) {
			throw new Error('OneDrive folder id not found for path')
		}
		return id
	}
	const root = await graphFetchJson<GraphDriveItem>({
		auth: args.auth,
		url: `${GRAPH_BASE_URL}/${base}/root?$select=id`
	})
	const id = String(root?.id ?? '').trim()
	if (!id) {
		throw new Error('OneDrive root id not found')
	}
	return id
}

const fetchDriveItem = async (args: {
	auth: OneDriveAuth
	drive: OneDriveDriveSelector
	itemId: string
}) => {
	const base = driveBasePath(args.drive)
	return graphFetchJson<GraphDriveItem>({
		auth: args.auth,
		url: `${GRAPH_BASE_URL}/${base}/items/${encodeURIComponent(
			args.itemId
		)}?$select=id,name,size,file,folder,deleted,parentReference,webUrl,lastModifiedDateTime,@microsoft.graph.downloadUrl`
	})
}

const downloadDriveItemBytes = async (args: {
	auth: OneDriveAuth
	drive: OneDriveDriveSelector
	itemId: string
	downloadUrl?: string
}) => {
	if (args.downloadUrl) {
		return graphDownload({auth: args.auth, url: args.downloadUrl})
	}
	const base = driveBasePath(args.drive)
	return graphDownloadFromPath({
		auth: args.auth,
		path: `${base}/items/${encodeURIComponent(args.itemId)}/content`
	})
}

const buildUpsertInput = (args: {
	item: GraphDriveItem
	driveId: string
	sourceIdPrefix?: string
	content: string
	assets: AssetInput[]
}) => {
	const itemId = String(args.item.id ?? '').trim()
	const sourceId = buildSourceId(args.sourceIdPrefix, args.driveId, itemId)
	const metadata: Metadata = {
		connector: 'onedrive',
		kind: 'file',
		itemId,
		name: args.item.name ?? '',
		mimeType: args.item.file?.mimeType ?? '',
		size: args.item.size ?? undefined,
		webUrl: args.item.webUrl ?? undefined,
		lastModifiedDateTime: args.item.lastModifiedDateTime ?? undefined
	}
	return {
		sourceId,
		content: args.content,
		assets: args.assets,
		metadata
	}
}

const itemToBytesAndContent = async (args: {
	auth: OneDriveAuth
	drive: OneDriveDriveSelector
	item: GraphDriveItem
	maxBytesPerFile: number
}) => {
	const itemId = String(args.item.id ?? '').trim()
	const size = Number(args.item.size ?? 0)
	if (Number.isFinite(size) && size > args.maxBytesPerFile) {
		return {skipped: true as const, reason: 'too_large'}
	}
	const bytes = await downloadDriveItemBytes({
		auth: args.auth,
		drive: args.drive,
		itemId,
		downloadUrl: args.item['@microsoft.graph.downloadUrl']
	})
	if (bytes.byteLength > args.maxBytesPerFile) {
		return {skipped: true as const, reason: 'too_large'}
	}
	const mimeType = args.item.file?.mimeType
	if (isTextLike(mimeType)) {
		const content = new TextDecoder('utf-8', {fatal: false}).decode(bytes)
		return {skipped: false as const, content, assets: []}
	}
	const asset: AssetInput = {
		assetId: itemId,
		kind: assetKindFromMediaType(mimeType),
		data: {
			kind: 'bytes',
			bytes,
			mediaType: mimeType || 'application/octet-stream',
			filename: args.item.name ?? undefined
		},
		uri: args.item.webUrl ?? undefined,
		metadata: {
			connector: 'onedrive',
			itemId,
			name: args.item.name ?? '',
			mimeType: mimeType ?? ''
		}
	}
	return {skipped: false as const, content: '', assets: [asset]}
}

/**
 * Stream OneDrive folder changes (delta-based).
 */
export async function* streamFolder(
	input: StreamOneDriveFolderInput
): ConnectorStream<OneDriveCheckpoint> {
	const options = input.options ?? {}
	const maxBytesPerFile = options.maxBytesPerFile ?? DEFAULT_MAX_BYTES
	const deleteOnRemoved = options.deleteOnRemoved ?? false
	const recursive = options.recursive ?? true
	const driveId = await resolveDriveId(input.auth, input.drive)
	const folderId = await resolveFolderId({
		auth: input.auth,
		drive: input.drive,
		folder: input.folder
	})

	let nextLink =
		input.checkpoint?.nextLink ??
		input.checkpoint?.deltaLink ??
		`${GRAPH_BASE_URL}/${driveBasePath(input.drive)}/items/${encodeURIComponent(
			folderId
		)}/delta?$select=id,name,size,file,folder,deleted,parentReference,webUrl,lastModifiedDateTime`

	let processed = 0

	while (nextLink) {
		const data = await graphFetchJson<{
			value?: GraphDriveItem[]
			'@odata.nextLink'?: string
			'@odata.deltaLink'?: string
		}>({
			auth: input.auth,
			url: nextLink
		})

		const items = data.value ?? []
		for (const item of items) {
			processed += 1
			const itemId = String(item.id ?? '').trim()
			if (!itemId) {
				continue
			}
			const sourceId = buildSourceId(
				input.sourceIdPrefix,
				driveId,
				itemId
			)

			yield {
				type: 'progress',
				message: 'file:start',
				current: processed,
				sourceId,
				entityId: itemId
			}

			if (item.deleted) {
				if (deleteOnRemoved) {
					yield {type: 'delete', input: {sourceId}}
				}
				continue
			}

			if (item.folder) {
				continue
			}

			if (!recursive) {
				const parentId = item.parentReference?.id
				if (parentId && parentId !== folderId) {
					if (deleteOnRemoved) {
						yield {type: 'delete', input: {sourceId}}
					}
					continue
				}
			}

			try {
				const full = await fetchDriveItem({
					auth: input.auth,
					drive: input.drive,
					itemId
				})
				const payload = await itemToBytesAndContent({
					auth: input.auth,
					drive: input.drive,
					item: full,
					maxBytesPerFile
				})
				if (payload.skipped) {
					yield {
						type: 'warning',
						code: 'file_skipped',
						message: `Skipping file because it exceeds maxBytesPerFile (${maxBytesPerFile}).`,
						data: {itemId, sourceId, reason: 'too_large'}
					}
					continue
				}

				yield {
					type: 'upsert',
					input: buildUpsertInput({
						item: full,
						driveId,
						sourceIdPrefix: input.sourceIdPrefix,
						content: payload.content,
						assets: payload.assets
					})
				}

				yield {
					type: 'progress',
					message: 'file:success',
					current: processed,
					sourceId,
					entityId: itemId
				}
			} catch (err) {
				if (isNotFound(err)) {
					yield {
						type: 'warning',
						code: 'file_not_found',
						message: 'OneDrive file not found or inaccessible.',
						data: {itemId, sourceId}
					}
					if (deleteOnRemoved) {
						yield {type: 'delete', input: {sourceId}}
					}
				} else {
					yield {
						type: 'warning',
						code: 'file_error',
						message: asMessage(err),
						data: {itemId, sourceId}
					}
				}
			}
		}

		const deltaLink = data['@odata.deltaLink']
		const next = data['@odata.nextLink']
		nextLink = next ?? deltaLink ?? ''

		if (nextLink) {
			yield {
				type: 'checkpoint',
				checkpoint: {
					nextLink: next ?? undefined,
					deltaLink: deltaLink ?? undefined,
					driveId,
					folderId
				}
			}
		}
	}
}

/**
 * Stream explicit OneDrive file IDs.
 */
export async function* streamFiles(
	input: StreamOneDriveFilesInput
): ConnectorStream<OneDriveCheckpoint> {
	const options = input.options ?? {}
	const maxBytesPerFile = options.maxBytesPerFile ?? DEFAULT_MAX_BYTES
	const driveId = await resolveDriveId(input.auth, input.drive)
	const fileIds = Array.isArray(input.fileIds) ? input.fileIds : []
	const startIndex = Math.max(0, input.checkpoint?.index ?? 0)

	let processed = 0
	for (let i = startIndex; i < fileIds.length; i++) {
		const rawId = fileIds[i]
		const itemId = String(rawId ?? '').trim()
		if (!itemId) {
			continue
		}
		processed += 1
		const sourceId = buildSourceId(input.sourceIdPrefix, driveId, itemId)

		yield {
			type: 'progress',
			message: 'file:start',
			current: processed,
			total: fileIds.length,
			sourceId,
			entityId: itemId
		}

		try {
			const full = await fetchDriveItem({
				auth: input.auth,
				drive: input.drive,
				itemId
			})
			if (full.deleted || full.folder) {
				yield {
					type: 'warning',
					code: 'file_skipped',
					message: 'Skipping non-file or deleted item.',
					data: {itemId, sourceId}
				}
				continue
			}
			const payload = await itemToBytesAndContent({
				auth: input.auth,
				drive: input.drive,
				item: full,
				maxBytesPerFile
			})
			if (payload.skipped) {
				yield {
					type: 'warning',
					code: 'file_skipped',
					message: `Skipping file because it exceeds maxBytesPerFile (${maxBytesPerFile}).`,
					data: {itemId, sourceId, reason: 'too_large'}
				}
				continue
			}

			yield {
				type: 'upsert',
				input: buildUpsertInput({
					item: full,
					driveId,
					sourceIdPrefix: input.sourceIdPrefix,
					content: payload.content,
					assets: payload.assets
				})
			}

			yield {
				type: 'progress',
				message: 'file:success',
				current: processed,
				total: fileIds.length,
				sourceId,
				entityId: itemId
			}
		} catch (err) {
			if (isNotFound(err)) {
				yield {
					type: 'warning',
					code: 'file_not_found',
					message: 'OneDrive file not found or inaccessible.',
					data: {itemId, sourceId}
				}
			} else {
				yield {
					type: 'warning',
					code: 'file_error',
					message: asMessage(err),
					data: {itemId, sourceId}
				}
			}
		}

		yield {
			type: 'checkpoint',
			checkpoint: {
				driveId,
				index: i + 1,
				itemId
			}
		}
	}
}

/**
 * Exported connector surface for OneDrive.
 */
export const oneDriveConnector = {
	streamFolder,
	streamFiles
}
