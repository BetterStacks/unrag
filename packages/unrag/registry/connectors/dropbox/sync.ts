import {
	dropboxApiFetch,
	dropboxDownload
} from '@registry/connectors/dropbox/client'
import type {
	DropboxAuth,
	DropboxCheckpoint,
	StreamDropboxFilesInput,
	StreamDropboxFolderInput
} from '@registry/connectors/dropbox/types'
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

const buildSourceId = (prefix: string | undefined, pathLower: string) =>
	joinPrefix(prefix, `dropbox:path:${pathLower}`)

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

type DropboxEntry = {
	'.tag': 'file' | 'folder' | 'deleted'
	id?: string
	name?: string
	path_lower?: string
	path_display?: string
	size?: number
	client_modified?: string
	server_modified?: string
	content_hash?: string
}

type DropboxListFolderResponse = {
	entries?: DropboxEntry[]
	cursor?: string
	has_more?: boolean
}

type DropboxMetadataResponse = DropboxEntry

const resolvePath = (entry: DropboxEntry) =>
	String(entry.path_lower ?? entry.path_display ?? '').trim()

const downloadFile = async (args: {
	auth: DropboxAuth
	path: string
	maxBytesPerFile: number
}) => {
	const {bytes, contentType} = await dropboxDownload({
		auth: args.auth,
		path: args.path
	})
	if (bytes.byteLength > args.maxBytesPerFile) {
		return {skipped: true as const, reason: 'too_large'}
	}
	if (isTextLike(contentType)) {
		const content = new TextDecoder('utf-8', {fatal: false}).decode(bytes)
		return {skipped: false as const, content, assets: []}
	}
	const asset: AssetInput = {
		assetId: args.path,
		kind: assetKindFromMediaType(contentType),
		data: {
			kind: 'bytes',
			bytes,
			mediaType: contentType || 'application/octet-stream',
			filename: args.path.split('/').pop()
		}
	}
	return {skipped: false as const, content: '', assets: [asset]}
}

const buildMetadata = (entry: DropboxEntry): Metadata => ({
	connector: 'dropbox',
	kind: 'file',
	fileId: entry.id ?? '',
	name: entry.name ?? '',
	path: entry.path_lower ?? entry.path_display ?? '',
	size: entry.size,
	clientModified: entry.client_modified,
	serverModified: entry.server_modified,
	contentHash: entry.content_hash
})

const isNotFound = (err: unknown): boolean => {
	const message =
		typeof err === 'object' && err !== null
			? String((err as {message?: unknown}).message ?? '')
			: ''
	return (
		message.toLowerCase().includes('not_found') || message.includes('404')
	)
}

/**
 * Stream Dropbox folder changes (cursor-based).
 */
export async function* streamFolder(
	input: StreamDropboxFolderInput
): ConnectorStream<DropboxCheckpoint> {
	const options = input.options ?? {}
	const maxBytesPerFile = options.maxBytesPerFile ?? DEFAULT_MAX_BYTES
	const deleteOnRemoved = options.deleteOnRemoved ?? false
	const recursive = options.recursive ?? true
	const folderPath = String(input.folderPath ?? '').trim()
	if (!folderPath) {
		throw new Error('Dropbox folderPath is required')
	}

	let cursor = input.checkpoint?.cursor
	let processed = 0

	while (true) {
		const data = cursor
			? await dropboxApiFetch<DropboxListFolderResponse>({
					auth: input.auth,
					path: 'files/list_folder/continue',
					body: {cursor}
				})
			: await dropboxApiFetch<DropboxListFolderResponse>({
					auth: input.auth,
					path: 'files/list_folder',
					body: {
						path: folderPath,
						recursive,
						include_deleted: true
					}
				})

		const entries = data.entries ?? []
		for (const entry of entries) {
			processed += 1
			const entryPath = resolvePath(entry)
			const sourceId = entryPath
				? buildSourceId(input.sourceIdPrefix, entryPath)
				: ''

			if (entry['.tag'] === 'deleted') {
				if (deleteOnRemoved && sourceId) {
					yield {type: 'delete', input: {sourceId}}
				}
				continue
			}
			if (entry['.tag'] === 'folder') {
				continue
			}
			if (!entryPath) {
				continue
			}

			yield {
				type: 'progress',
				message: 'file:start',
				current: processed,
				sourceId,
				entityId: entry.id ?? entryPath
			}

			if (
				Number.isFinite(entry.size) &&
				(entry.size as number) > maxBytesPerFile
			) {
				yield {
					type: 'warning',
					code: 'file_skipped',
					message: `Skipping file because it exceeds maxBytesPerFile (${maxBytesPerFile}).`,
					data: {path: entryPath, sourceId, reason: 'too_large'}
				}
				continue
			}

			try {
				const payload = await downloadFile({
					auth: input.auth,
					path: entryPath,
					maxBytesPerFile
				})
				if (payload.skipped) {
					yield {
						type: 'warning',
						code: 'file_skipped',
						message: `Skipping file because it exceeds maxBytesPerFile (${maxBytesPerFile}).`,
						data: {path: entryPath, sourceId, reason: 'too_large'}
					}
					continue
				}

				yield {
					type: 'upsert',
					input: {
						sourceId,
						content: payload.content,
						assets: payload.assets,
						metadata: buildMetadata(entry)
					}
				}

				yield {
					type: 'progress',
					message: 'file:success',
					current: processed,
					sourceId,
					entityId: entry.id ?? entryPath
				}
			} catch (err) {
				if (isNotFound(err)) {
					yield {
						type: 'warning',
						code: 'file_not_found',
						message: 'Dropbox file not found or inaccessible.',
						data: {path: entryPath, sourceId}
					}
					if (deleteOnRemoved) {
						yield {type: 'delete', input: {sourceId}}
					}
				} else {
					yield {
						type: 'warning',
						code: 'file_error',
						message: asMessage(err),
						data: {path: entryPath, sourceId}
					}
				}
			}
		}

		if (data.cursor) {
			yield {
				type: 'checkpoint',
				checkpoint: {
					cursor: data.cursor,
					path: folderPath
				}
			}
		}

		cursor = data.cursor ?? cursor
		if (!data.has_more) {
			break
		}
	}
}

/**
 * Stream explicit Dropbox file IDs.
 */
export async function* streamFiles(
	input: StreamDropboxFilesInput
): ConnectorStream<DropboxCheckpoint> {
	const options = input.options ?? {}
	const maxBytesPerFile = options.maxBytesPerFile ?? DEFAULT_MAX_BYTES
	const fileIds = Array.isArray(input.fileIds) ? input.fileIds : []
	const startIndex = Math.max(0, input.checkpoint?.index ?? 0)

	let processed = 0
	for (let i = startIndex; i < fileIds.length; i++) {
		const fileId = String(fileIds[i] ?? '').trim()
		if (!fileId) {
			continue
		}
		processed += 1

		yield {
			type: 'progress',
			message: 'file:start',
			current: processed,
			total: fileIds.length,
			entityId: fileId
		}

		try {
			const meta = await dropboxApiFetch<DropboxMetadataResponse>({
				auth: input.auth,
				path: 'files/get_metadata',
				body: {path: fileId}
			})
			if (meta['.tag'] !== 'file') {
				yield {
					type: 'warning',
					code: 'file_skipped',
					message: 'Skipping non-file entry.',
					data: {fileId}
				}
				continue
			}
			const entryPath = resolvePath(meta)
			if (!entryPath) {
				yield {
					type: 'warning',
					code: 'file_skipped',
					message: 'Missing path for file.',
					data: {fileId}
				}
				continue
			}
			const sourceId = buildSourceId(input.sourceIdPrefix, entryPath)
			if (
				Number.isFinite(meta.size) &&
				(meta.size as number) > maxBytesPerFile
			) {
				yield {
					type: 'warning',
					code: 'file_skipped',
					message: `Skipping file because it exceeds maxBytesPerFile (${maxBytesPerFile}).`,
					data: {path: entryPath, sourceId, reason: 'too_large'}
				}
				continue
			}
			const payload = await downloadFile({
				auth: input.auth,
				path: entryPath,
				maxBytesPerFile
			})
			if (payload.skipped) {
				yield {
					type: 'warning',
					code: 'file_skipped',
					message: `Skipping file because it exceeds maxBytesPerFile (${maxBytesPerFile}).`,
					data: {path: entryPath, sourceId, reason: 'too_large'}
				}
				continue
			}

			yield {
				type: 'upsert',
				input: {
					sourceId,
					content: payload.content,
					assets: payload.assets,
					metadata: buildMetadata(meta)
				}
			}

			yield {
				type: 'progress',
				message: 'file:success',
				current: processed,
				total: fileIds.length,
				sourceId,
				entityId: fileId
			}
		} catch (err) {
			if (isNotFound(err)) {
				yield {
					type: 'warning',
					code: 'file_not_found',
					message: 'Dropbox file not found or inaccessible.',
					data: {fileId}
				}
			} else {
				yield {
					type: 'warning',
					code: 'file_error',
					message: asMessage(err),
					data: {fileId}
				}
			}
		}

		yield {
			type: 'checkpoint',
			checkpoint: {
				index: i + 1,
				fileId
			}
		}
	}
}

/**
 * Exported connector surface for Dropbox.
 */
export const dropboxConnector = {
	streamFolder,
	streamFiles
}
