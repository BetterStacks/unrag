import type {AssetInput, Metadata} from '@registry/core'

export type OneDriveDelegatedAccessTokenAuth = {
	kind: 'delegated_access_token'
	accessToken: string
}

export type OneDriveDelegatedRefreshTokenAuth = {
	kind: 'delegated_refresh_token'
	tenantId: string
	clientId: string
	clientSecret: string
	refreshToken: string
	scopes?: string[]
}

export type OneDriveAppClientCredentialsAuth = {
	kind: 'app_client_credentials'
	tenantId: string
	clientId: string
	clientSecret: string
	scopes?: string[]
}

export type OneDriveAuth =
	| OneDriveDelegatedAccessTokenAuth
	| OneDriveDelegatedRefreshTokenAuth
	| OneDriveAppClientCredentialsAuth

export type OneDriveDriveSelector =
	| {kind: 'me'}
	| {kind: 'user'; userId: string}
	| {kind: 'drive'; driveId: string}

export type OneDriveFolderSelector = {
	/** Drive item ID. */
	id?: string
	/** Path relative to drive root (e.g. /KnowledgeBase). */
	path?: string
}

export type OneDriveCheckpoint = {
	/** Delta link for resuming incremental sync. */
	deltaLink?: string
	/** Next link for mid-page continuation. */
	nextLink?: string
	/** Drive ID used for this stream. */
	driveId?: string
	/** Folder ID being synced. */
	folderId?: string
	/** Explicit-ID streams can use index for resuming. */
	index?: number
	/** Helpful for debugging/resume sanity checks. */
	itemId?: string
}

export type OneDriveFileDocument = {
	sourceId: string
	content: string
	metadata: Metadata
	assets: AssetInput[]
}

export type StreamOneDriveOptions = {
	/** Max bytes to download per file. Default: 15MB. */
	maxBytesPerFile?: number
	/** Emit delete events when items are removed or deleted. Default: false. */
	deleteOnRemoved?: boolean
	/** Whether to sync recursively. Default: true. */
	recursive?: boolean
}

export type StreamOneDriveFolderInput = {
	auth: OneDriveAuth
	drive: OneDriveDriveSelector
	/** Folder selector (id or path). Defaults to root. */
	folder?: OneDriveFolderSelector
	/** Optional namespace prefix for sourceId. */
	sourceIdPrefix?: string
	options?: StreamOneDriveOptions
	checkpoint?: OneDriveCheckpoint
}

export type StreamOneDriveFilesInput = {
	auth: OneDriveAuth
	drive: OneDriveDriveSelector
	fileIds: string[]
	/** Optional namespace prefix for sourceId. */
	sourceIdPrefix?: string
	options?: StreamOneDriveOptions
	/** Optional checkpoint to resume from (index-based). */
	checkpoint?: OneDriveCheckpoint
}
