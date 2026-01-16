/**
 * Ambient shims for optional dependencies.
 *
 * `unrag` vendors optional connectors/extractors into user projects. We want the core
 * package to typecheck even when those optional third-party deps are not installed.
 *
 * These are intentionally minimal and typed as `any` to avoid implying API stability.
 */

// biome-ignore lint/suspicious/noExplicitAny: these are optional-dependency shims; `any` avoids implying API stability.
type ShimAny = any

// ---------------------------------------------------------------------------
// Google Drive connector (optional)
// ---------------------------------------------------------------------------
declare module 'google-auth-library' {
	export const OAuth2Client: ShimAny
	export const OAuth2: ShimAny
	export const GoogleAuth: ShimAny
	export const JWT: ShimAny
}

declare module 'googleapis' {
	export const google: ShimAny
}

// ---------------------------------------------------------------------------
// Notion connector (optional)
// ---------------------------------------------------------------------------
declare module '@notionhq/client' {
	export type ClientOptions = ShimAny
	export class Client {
		constructor(options?: ShimAny)
		pages: ShimAny
		blocks: ShimAny
	}
	export const isFullPage: (x: unknown) => boolean
}

declare module '@notionhq/client/build/src/api-endpoints' {
	export type GetPageResponse = ShimAny
	export type ListBlockChildrenResponse = ShimAny
	export type RichTextItemResponse = ShimAny
}

// ---------------------------------------------------------------------------
// File extractors (optional)
// ---------------------------------------------------------------------------
declare module 'mammoth' {
	const mammoth: ShimAny
	export = mammoth
}

declare module 'jszip' {
	const JSZip: ShimAny
	export = JSZip
}

declare module 'xlsx' {
	const XLSX: ShimAny
	export = XLSX
}
