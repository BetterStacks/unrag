import type {
	DropboxAccessTokenAuth,
	DropboxAuth,
	DropboxRefreshTokenAuth
} from '@registry/connectors/dropbox/types'

const API_BASE = 'https://api.dropboxapi.com/2'
const CONTENT_BASE = 'https://content.dropboxapi.com/2'
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'

const isAccessToken = (auth: DropboxAuth): auth is DropboxAccessTokenAuth =>
	auth.kind === 'access_token'

const isRefreshToken = (auth: DropboxAuth): auth is DropboxRefreshTokenAuth =>
	auth.kind === 'oauth_refresh_token'

const requestToken = async (params: Record<string, string>) => {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body: new URLSearchParams(params)
	})
	if (!res.ok) {
		throw new Error(
			`Dropbox token request failed (${res.status}): ${await res.text()}`
		)
	}
	const data = (await res.json()) as Record<string, unknown>
	const accessToken = String(data.access_token ?? '')
	if (!accessToken) {
		throw new Error('Dropbox token response missing access_token')
	}
	return accessToken
}

export const getDropboxAccessToken = async (
	auth: DropboxAuth
): Promise<string> => {
	if (!auth || typeof auth !== 'object') {
		throw new Error('Dropbox auth is required')
	}
	if (isAccessToken(auth)) {
		if (!auth.accessToken) {
			throw new Error('Dropbox access token is required')
		}
		return auth.accessToken
	}
	if (isRefreshToken(auth)) {
		if (!auth.clientId || !auth.clientSecret || !auth.refreshToken) {
			throw new Error(
				'Dropbox refresh token auth requires clientId, clientSecret, and refreshToken'
			)
		}
		return requestToken({
			grant_type: 'refresh_token',
			client_id: auth.clientId,
			client_secret: auth.clientSecret,
			refresh_token: auth.refreshToken
		})
	}
	throw new Error(`Unknown Dropbox auth kind: ${String((auth as any)?.kind)}`)
}

export const dropboxApiFetch = async <T>(args: {
	auth: DropboxAuth
	path: string
	body?: unknown
}) => {
	const token = await getDropboxAccessToken(args.auth)
	const res = await fetch(`${API_BASE}/${args.path.replace(/^\\//, '')}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(args.body ?? {})
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Dropbox API failed (${res.status}): ${text}`)
	}
	return (await res.json()) as T
}

export const dropboxDownload = async (args: {
	auth: DropboxAuth
	path: string
}) => {
	const token = await getDropboxAccessToken(args.auth)
	const res = await fetch(`${CONTENT_BASE}/files/download`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Dropbox-API-Arg': JSON.stringify({path: args.path})
		}
	})
	if (!res.ok) {
		throw new Error(
			`Dropbox download failed (${res.status}): ${await res.text()}`
		)
	}
	return {
		bytes: new Uint8Array(await res.arrayBuffer()),
		contentType: res.headers.get('content-type') ?? undefined
	}
}
