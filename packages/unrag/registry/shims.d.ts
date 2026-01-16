/**
 * Ambient shims for optional dependencies.
 *
 * `unrag` vendors optional connectors/extractors into user projects. We want the core
 * package to typecheck even when those optional third-party deps are not installed.
 *
 * These are intentionally minimal and typed as `any` to avoid implying API stability.
 */

// ---------------------------------------------------------------------------
// Google Drive connector (optional)
// ---------------------------------------------------------------------------
declare module 'google-auth-library' {
	export const OAuth2Client: any
	export const OAuth2: any
	export const GoogleAuth: any
	export const JWT: any
}

declare module 'googleapis' {
	export const google: any
}

// ---------------------------------------------------------------------------
// Notion connector (optional)
// ---------------------------------------------------------------------------
declare module '@notionhq/client' {
	export type ClientOptions = any
	export class Client {
		constructor(options?: any)
		pages: any
		blocks: any
	}
	export const isFullPage: (x: unknown) => boolean
}

declare module '@notionhq/client/build/src/api-endpoints' {
	export type GetPageResponse = any
	export type ListBlockChildrenResponse = any
	export type RichTextItemResponse = any
}

// ---------------------------------------------------------------------------
// File extractors (optional)
// ---------------------------------------------------------------------------
declare module 'mammoth' {
	const mammoth: any
	export = mammoth
}

declare module 'jszip' {
	const JSZip: any
	export = JSZip
}

declare module 'xlsx' {
	const XLSX: any
	export = XLSX
}
