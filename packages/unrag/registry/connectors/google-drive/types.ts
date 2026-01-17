import type {AssetInput, IngestInput, Metadata} from '@registry/core'

/**
 * Service account credentials structure.
 */
export interface ServiceAccountCredentials {
	client_email: string
	private_key: string
	[key: string]: unknown
}

/**
 * OAuth auth with an existing client instance.
 */
export type GoogleDriveOAuthClientAuth = {
	/** Use an existing OAuth2 client instance (recommended if your app already has one). */
	kind: 'oauth'
	oauthClient: unknown
	clientId?: never
	clientSecret?: never
	redirectUri?: never
	refreshToken?: never
	accessToken?: never
}

/**
 * OAuth auth with credentials for building a client.
 */
export type GoogleDriveOAuthConfigAuth = {
	/**
	 * Convenience form for OAuth2: the connector will construct an OAuth2 client
	 * and set credentials including the refresh token.
	 */
	kind: 'oauth'
	clientId: string
	clientSecret: string
	redirectUri: string
	refreshToken: string
	/** Optional access token if you already have one. */
	accessToken?: string
	oauthClient?: never
}

/**
 * OAuth auth (either form).
 */
export type GoogleDriveOAuthAuth =
	| GoogleDriveOAuthClientAuth
	| GoogleDriveOAuthConfigAuth

/**
 * Service account auth.
 */
export type GoogleDriveServiceAccountAuth = {
	/**
	 * Service account credentials. This supports both:
	 * - direct service-account access (files must be shared to the service account)
	 * - Workspace domain-wide delegation (DWD) when `subject` is provided
	 */
	kind: 'service_account'
	credentialsJson: string | ServiceAccountCredentials
	/**
	 * DWD impersonation subject email (Workspace only).
	 * When provided, the service account will impersonate this user.
	 */
	subject?: string
}

/**
 * Google Auth escape hatch.
 */
export type GoogleDriveGoogleAuthAuth = {
	/** Escape hatch: provide a pre-configured GoogleAuth (or equivalent) instance. */
	kind: 'google_auth'
	auth: unknown
}

/**
 * A plug-and-play auth input for Google Drive.
 *
 * This is intentionally structural (no hard dependency on google-auth-library types),
 * because the connector code is vendored into user projects and dependencies are added
 * by the CLI (`unrag add google-drive`).
 */
export type GoogleDriveAuth =
	| GoogleDriveOAuthAuth
	| GoogleDriveServiceAccountAuth
	| GoogleDriveGoogleAuthAuth

/**
 * Opaque, JSON-serializable checkpoint for resuming a Google Drive stream.
 * Store this in your DB/KV and pass it back to `streamFiles`.
 */
export type GoogleDriveCheckpoint = {
	/** Next index to process (0-based). */
	index: number
	/** Helpful for debugging/resume sanity checks. */
	fileId?: string
}

/**
 * Checkpoint for folder-based Google Drive sync using Changes API.
 */
export type GoogleDriveFolderCheckpoint = {
	/**
	 * Page token for the Drive Changes API. On first run this is the
	 * startPageToken; subsequent runs use the last saved token.
	 */
	pageToken: string
	/** Folder being synced (for sanity checks). */
	folderId: string
	/** Optional driveId for shared drives. */
	driveId?: string
}

export type GoogleDriveFileDocument = {
	sourceId: string
	content: string
	metadata: Metadata
	assets: AssetInput[]
}

export type BuildGoogleDriveFileIngestInputArgs = {
	fileId: string
	content: string
	assets?: AssetInput[]
	metadata?: Metadata
	sourceIdPrefix?: string
}

export type BuildGoogleDriveFileIngestInputResult = IngestInput

export type StreamGoogleDriveFilesInput = {
	auth: GoogleDriveAuth
	/** Explicit Drive file IDs (Notion-like v1 behavior). */
	fileIds: string[]
	/**
	 * Optional namespace prefix, useful for multi-tenant apps:
	 * `tenant:acme:` -> `tenant:acme:gdrive:file:<id>`
	 */
	sourceIdPrefix?: string
	/**
	 * When true, if a file is not found/accessible, delete the previously ingested
	 * document for that file (exact sourceId).
	 */
	deleteOnNotFound?: boolean
	/** Optional connector-level knobs. */
	options?: StreamGoogleDriveFilesOptions
	/**
	 * Optional checkpoint to resume from.
	 */
	checkpoint?: GoogleDriveCheckpoint
}

export type StreamGoogleDriveFolderInput = {
	auth: GoogleDriveAuth
	/** Folder ID to sync from (required). */
	folderId: string
	/**
	 * Optional namespace prefix, useful for multi-tenant apps:
	 * `tenant:acme:` -> `tenant:acme:gdrive:folder:<folderId>:file:<id>`
	 */
	sourceIdPrefix?: string
	/** Optional connector-level knobs. */
	options?: StreamGoogleDriveFolderOptions
	/**
	 * Optional checkpoint to resume from.
	 */
	checkpoint?: GoogleDriveFolderCheckpoint
}

export type StreamGoogleDriveFilesOptions = {
	/** Max bytes to download/export per file. Default: 15MB. */
	maxBytesPerFile?: number
	/**
	 * If true, treat 403 (forbidden) as not-found for cleanup purposes.
	 * Default: true.
	 */
	treatForbiddenAsNotFound?: boolean
	/**
	 * If true, failures to export Google-native files (e.g., Slides -> text)
	 * will cause the file to be skipped instead of falling back to a binary export.
	 * Default: false (best-effort fallback).
	 */
	strictNativeExport?: boolean
	/** Override Drive API scopes if desired. */
	scopes?: string[]
}

export type StreamGoogleDriveFolderOptions = {
	/** Max bytes to download/export per file. Default: 15MB. */
	maxBytesPerFile?: number
	/**
	 * If true, failures to export Google-native files (e.g., Slides -> text)
	 * will cause the file to be skipped instead of falling back to a binary export.
	 * Default: false (best-effort fallback).
	 */
	strictNativeExport?: boolean
	/**
	 * If true, treat 403 (forbidden) responses as not-found for cleanup purposes.
	 * Default: true.
	 */
	treatForbiddenAsNotFound?: boolean
	/** Whether to include nested folders. Default: true. */
	recursive?: boolean
	/** Emit delete events when items are removed or moved out. Default: false. */
	deleteOnRemoved?: boolean
	/** Drive Changes API options for shared drives. */
	driveId?: string
	supportsAllDrives?: boolean
	includeItemsFromAllDrives?: boolean
	/** Page size for Changes API. */
	pageSize?: number
	/** Override Drive API scopes if desired. */
	scopes?: string[]
}
