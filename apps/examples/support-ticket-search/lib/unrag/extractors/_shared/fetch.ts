import type {AssetData, AssetFetchConfig} from '@unrag/core/types'

const DEFAULT_UA = 'unrag/asset-fetch'

const isProbablyIpLiteral = (host: string) =>
	/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')

const isDisallowedHost = (host: string) => {
	const h = host.toLowerCase()
	if (h === 'localhost' || h.endsWith('.localhost')) {
		return true
	}
	if (h === '0.0.0.0') {
		return true
	}
	if (h === '127.0.0.1' || h.startsWith('127.')) {
		return true
	}
	if (h === '::1') {
		return true
	}

	// If host is an IP literal, block common private ranges.
	if (isProbablyIpLiteral(h)) {
		if (h.startsWith('10.')) {
			return true
		}
		if (h.startsWith('192.168.')) {
			return true
		}
		if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) {
			return true
		}
	}

	return false
}

export async function fetchBytesFromUrl(args: {
	url: string
	fetchConfig: AssetFetchConfig
	headers?: Record<string, string>
	maxBytes: number
}): Promise<{bytes: Uint8Array; mediaType?: string}> {
	if (!args.fetchConfig.enabled) {
		throw new Error(
			'Asset fetch disabled (assetProcessing.fetch.enabled=false)'
		)
	}

	const u = new URL(args.url)
	if (u.protocol !== 'https:') {
		throw new Error('Only https:// URLs are allowed for asset fetching')
	}

	if (isDisallowedHost(u.hostname)) {
		throw new Error(`Disallowed host for asset fetch: ${u.hostname}`)
	}

	const allow = args.fetchConfig.allowedHosts
	if (Array.isArray(allow) && allow.length > 0) {
		const ok = allow.some(
			(h) => h.toLowerCase() === u.hostname.toLowerCase()
		)
		if (!ok) {
			throw new Error(
				`Host not allowlisted for asset fetch: ${u.hostname}`
			)
		}
	}

	const abortSignal = AbortSignal.timeout(args.fetchConfig.timeoutMs)
	const headers = {
		'user-agent': DEFAULT_UA,
		...(args.fetchConfig.headers ?? {}),
		...(args.headers ?? {})
	}

	const res = await fetch(args.url, {headers, signal: abortSignal})
	if (!res.ok) {
		throw new Error(`Asset fetch failed (${res.status} ${res.statusText})`)
	}

	const contentLength = Number(
		res.headers.get('content-length') ?? Number.NaN
	)
	if (Number.isFinite(contentLength) && contentLength > args.maxBytes) {
		throw new Error(
			`Asset too large (content-length ${contentLength} > ${args.maxBytes})`
		)
	}

	const buf = new Uint8Array(await res.arrayBuffer())
	if (buf.byteLength > args.maxBytes) {
		throw new Error(
			`Asset too large (${buf.byteLength} > ${args.maxBytes})`
		)
	}

	const mediaType = res.headers.get('content-type')?.split(';')[0]?.trim()
	return {bytes: buf, mediaType: mediaType || undefined}
}

export async function getAssetBytes(args: {
	data: AssetData
	fetchConfig: AssetFetchConfig
	maxBytes: number
	/** Optional fallback when data does not provide a mediaType and the response lacks one. */
	defaultMediaType?: string
}): Promise<{bytes: Uint8Array; mediaType: string; filename?: string}> {
	if (args.data.kind === 'bytes') {
		return {
			bytes: args.data.bytes,
			mediaType: args.data.mediaType,
			...(args.data.filename ? {filename: args.data.filename} : {})
		}
	}

	const fetched = await fetchBytesFromUrl({
		url: args.data.url,
		fetchConfig: args.fetchConfig,
		headers: args.data.headers,
		maxBytes: args.maxBytes
	})

	return {
		bytes: fetched.bytes,
		mediaType:
			args.data.mediaType ??
			fetched.mediaType ??
			args.defaultMediaType ??
			'application/octet-stream',
		...(args.data.filename ? {filename: args.data.filename} : {})
	}
}
