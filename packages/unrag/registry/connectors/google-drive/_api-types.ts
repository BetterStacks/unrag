/**
 * Structural types for the Google Drive API.
 *
 * These are minimal interfaces that match the googleapis API structure,
 * allowing the connector to work without depending on googleapis types at compile time.
 */

export interface DriveFile {
	id?: string | null
	name?: string | null
	mimeType?: string | null
	size?: string | null
	trashed?: boolean | null
	webViewLink?: string | null
	webContentLink?: string | null
	iconLink?: string | null
	md5Checksum?: string | null
	driveId?: string | null
	modifiedTime?: string | null
	parents?: string[] | null
	shortcutDetails?: {
		targetId?: string | null
		targetMimeType?: string | null
	} | null
}

export interface DriveFileList {
	files?: DriveFile[]
	nextPageToken?: string | null
}

export interface DriveFilesResource {
	/**
	 * File metadata request.
	 *
	 * Note: googleapis overloads `files.get` based on `alt=media`.
	 * Our connector uses:
	 * - metadata calls (`fields=...`) which return a JSON object
	 * - media downloads (`alt=media`) which return bytes / string
	 *
	 * Model that here so TypeScript can safely access metadata fields like `parents`.
	 */
	get(params: {
		fileId: string
		fields?: string
		alt?: undefined
		supportsAllDrives?: boolean
	}): Promise<{data: DriveFile}>

	/**
	 * File content download request.
	 */
	get(params: {
		fileId: string
		alt: 'media'
		supportsAllDrives?: boolean
	}): Promise<{data: ArrayBuffer | string}>

	list(params: {
		q?: string
		fields?: string
		pageToken?: string
		pageSize?: number
		supportsAllDrives?: boolean
		includeItemsFromAllDrives?: boolean
	}): Promise<{data: DriveFileList}>

	export(params: {
		fileId: string
		mimeType: string
	}): Promise<{data: ArrayBuffer | string}>
}

export interface DriveChange {
	fileId?: string | null
	removed?: boolean | null
	file?: DriveFile | null
}

export interface DriveChangeList {
	changes?: DriveChange[]
	nextPageToken?: string | null
	newStartPageToken?: string | null
}

export interface DriveChangesResource {
	getStartPageToken(params: {
		driveId?: string
		supportsAllDrives?: boolean
	}): Promise<{data: {startPageToken?: string | null}}>

	list(params: {
		pageToken: string
		pageSize?: number
		fields?: string
		includeItemsFromAllDrives?: boolean
		supportsAllDrives?: boolean
		driveId?: string
		restrictToMyDrive?: boolean
	}): Promise<{data: DriveChangeList}>
}

export interface DriveClient {
	files: DriveFilesResource
	changes: DriveChangesResource
}

/**
 * Auth client interface - minimal subset used by the connector.
 */
export interface AuthClient {
	getAccessToken?(): Promise<{token?: string | null}>
}
