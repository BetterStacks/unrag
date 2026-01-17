import type {
	OneDriveAppClientCredentialsAuth,
	OneDriveAuth,
	OneDriveDelegatedAccessTokenAuth,
	OneDriveDelegatedRefreshTokenAuth
} from '@registry/connectors/onedrive/types'

export const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'

const isDelegatedAccessToken = (
	auth: OneDriveAuth
): auth is OneDriveDelegatedAccessTokenAuth =>
	auth.kind === 'delegated_access_token'

const isDelegatedRefreshToken = (
	auth: OneDriveAuth
): auth is OneDriveDelegatedRefreshTokenAuth =>
	auth.kind === 'delegated_refresh_token'

const isClientCredentials = (
	auth: OneDriveAuth
): auth is OneDriveAppClientCredentialsAuth =>
	auth.kind === 'app_client_credentials'

const tokenEndpoint = (tenantId: string) =>
	`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

const defaultAppScopes = ['https://graph.microsoft.com/.default']

const requestToken = async (params: {
	tokenUrl: string
	body: Record<string, string>
}) => {
	const res = await fetch(params.tokenUrl, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body: new URLSearchParams(params.body)
	})
	if (!res.ok) {
		throw new Error(
			`OneDrive token request failed (${res.status}): ${await res.text()}`
		)
	}
	const data = (await res.json()) as Record<string, unknown>
	const accessToken = String(data.access_token ?? '')
	if (!accessToken) {
		throw new Error('OneDrive token response missing access_token')
	}
	return accessToken
}

export const getOneDriveAccessToken = async (
	auth: OneDriveAuth
): Promise<string> => {
	if (!auth || typeof auth !== 'object') {
		throw new Error('OneDrive auth is required')
	}

	if (isDelegatedAccessToken(auth)) {
		if (!auth.accessToken) {
			throw new Error('OneDrive delegated access token is required')
		}
		return auth.accessToken
	}

	if (isDelegatedRefreshToken(auth)) {
		if (
			!auth.tenantId ||
			!auth.clientId ||
			!auth.clientSecret ||
			!auth.refreshToken
		) {
			throw new Error(
				'OneDrive delegated refresh token auth requires tenantId, clientId, clientSecret, and refreshToken'
			)
		}
		const body: Record<string, string> = {
			grant_type: 'refresh_token',
			client_id: auth.clientId,
			client_secret: auth.clientSecret,
			refresh_token: auth.refreshToken
		}
		if (auth.scopes && auth.scopes.length > 0) {
			body.scope = auth.scopes.join(' ')
		}
		return requestToken({
			tokenUrl: tokenEndpoint(auth.tenantId),
			body
		})
	}

	if (isClientCredentials(auth)) {
		if (!auth.tenantId || !auth.clientId || !auth.clientSecret) {
			throw new Error(
				'OneDrive client credentials auth requires tenantId, clientId, and clientSecret'
			)
		}
		const scopes = auth.scopes?.length ? auth.scopes : defaultAppScopes
		return requestToken({
			tokenUrl: tokenEndpoint(auth.tenantId),
			body: {
				grant_type: 'client_credentials',
				client_id: auth.clientId,
				client_secret: auth.clientSecret,
				scope: scopes.join(' ')
			}
		})
	}

	const kind =
		typeof auth === 'object' && auth !== null
			? (auth as {kind?: unknown}).kind
			: undefined
	throw new Error(`Unknown OneDrive auth kind: ${String(kind)}`)
}

export const graphFetchJson = async <T>(args: {
	auth: OneDriveAuth
	url: string
	method?: string
	headers?: Record<string, string>
	body?: unknown
}) => {
	const token = await getOneDriveAccessToken(args.auth)
	const url = args.url.startsWith('http')
		? args.url
		: `${GRAPH_BASE_URL}/${args.url.replace(/^\//, '')}`
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		...(args.headers ?? {})
	}
	let body: string | undefined
	if (args.body !== undefined) {
		headers['Content-Type'] =
			headers['Content-Type'] ?? 'application/json; charset=utf-8'
		body = JSON.stringify(args.body)
	}
	const res = await fetch(url, {
		method: args.method ?? 'GET',
		headers,
		body
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`OneDrive request failed (${res.status}): ${text}`)
	}
	return (await res.json()) as T
}

export const graphDownload = async (args: {
	auth: OneDriveAuth
	url: string
}) => {
	const token = await getOneDriveAccessToken(args.auth)
	const res = await fetch(args.url, {
		headers: {Authorization: `Bearer ${token}`}
	})
	if (!res.ok) {
		throw new Error(
			`OneDrive download failed (${res.status}): ${await res.text()}`
		)
	}
	return new Uint8Array(await res.arrayBuffer())
}

export const graphDownloadFromPath = async (args: {
	auth: OneDriveAuth
	path: string
}) => {
	const token = await getOneDriveAccessToken(args.auth)
	const url = `${GRAPH_BASE_URL}/${args.path.replace(/^\//, '')}`
	const res = await fetch(url, {
		headers: {Authorization: `Bearer ${token}`}
	})
	if (!res.ok) {
		throw new Error(
			`OneDrive download failed (${res.status}): ${await res.text()}`
		)
	}
	return new Uint8Array(await res.arrayBuffer())
}
