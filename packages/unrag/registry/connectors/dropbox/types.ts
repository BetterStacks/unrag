import type {AssetInput, Metadata} from '@registry/core'

export type DropboxAccessTokenAuth = {
	kind: 'access_token'
	accessToken: string
}

export type DropboxRefreshTokenAuth = {
	kind: 'oauth_refresh_token'
	clientId: string
	clientSecret: string
	refreshToken: string
}

export type DropboxAuth = DropboxAccessTokenAuth | DropboxRefreshTokenAuth

export type DropboxCheckpoint = {
	/** Cursor for list_folder continuation (folder sync). */
	cursor?: string
	/** Folder path for sanity checks. */
	path?: string
	/** Index for explicit ID sync resume. */
	index?: number
	/** Helpful for debugging/resume sanity checks. */
	fileId?: string
}

export type DropboxFileDocument = {
	sourceId: string
	content: string
	metadata: Metadata
	assets: AssetInput[]
}

export type StreamDropboxOptions = {
	/** Max bytes to download per file. Default: 15MB. */
	maxBytesPerFile?: number
	/** Emit delete events when items are removed or deleted. Default: false. */
	deleteOnRemoved?: boolean
	/** Whether to sync recursively. Default: true. */
	recursive?: boolean
}

export type StreamDropboxFolderInput = {
	auth: DropboxAuth
	folderPath: string
	sourceIdPrefix?: string
	options?: StreamDropboxOptions
	checkpoint?: DropboxCheckpoint
}

export type StreamDropboxFilesInput = {
	auth: DropboxAuth
	fileIds: string[]
	sourceIdPrefix?: string
	options?: StreamDropboxOptions
	checkpoint?: DropboxCheckpoint
}
