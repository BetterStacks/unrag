import {afterEach, describe, expect, test} from 'bun:test'
import {getOneDriveAccessToken} from '@registry/connectors/onedrive/client'
import {oneDriveConnector} from '@registry/connectors/onedrive/sync'

describe('onedrive connector: auth validation', () => {
	test('delegated access token returns token', async () => {
		await expect(
			getOneDriveAccessToken({
				kind: 'delegated_access_token',
				accessToken: 'token'
			})
		).resolves.toBe('token')
	})

	test('delegated refresh token requires fields', async () => {
		await expect(
			getOneDriveAccessToken({
				kind: 'delegated_refresh_token',
				tenantId: '',
				clientId: '',
				clientSecret: '',
				refreshToken: ''
			})
		).rejects.toThrow()
	})

	test('client credentials requires fields', async () => {
		await expect(
			getOneDriveAccessToken({
				kind: 'app_client_credentials',
				tenantId: '',
				clientId: '',
				clientSecret: ''
			})
		).rejects.toThrow()
	})
})

describe('onedrive connector: deleteOnRemoved behavior', () => {
	const originalFetch = globalThis.fetch

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('emits delete events when deleteOnRemoved=true', async () => {
		globalThis.fetch = (async (url: RequestInfo) => {
			const u = String(url)
			if (u.includes('/me/drive?$select=id')) {
				return new Response(JSON.stringify({id: 'drive123'}), {
					status: 200,
					headers: {'Content-Type': 'application/json'}
				})
			}
			if (u.includes('/me/drive/root:/kb?$select=id')) {
				return new Response(JSON.stringify({id: 'folder123'}), {
					status: 200,
					headers: {'Content-Type': 'application/json'}
				})
			}
			if (u.includes('/delta')) {
				return new Response(
					JSON.stringify({
						value: [{id: 'item123', deleted: {}}],
						'@odata.deltaLink':
							'https://graph.microsoft.com/v1.0/delta'
					}),
					{status: 200, headers: {'Content-Type': 'application/json'}}
				)
			}
			return new Response('{}', {
				status: 200,
				headers: {'Content-Type': 'application/json'}
			})
		}) as typeof fetch

		const events: Array<{type: string}> = []
		const stream = oneDriveConnector.streamFolder({
			auth: {kind: 'delegated_access_token', accessToken: 'x'},
			drive: {kind: 'me'},
			folder: {path: '/kb'},
			options: {deleteOnRemoved: true}
		})

		for await (const event of stream) {
			events.push({type: event.type})
		}

		expect(events.some((e) => e.type === 'delete')).toBe(true)
	})
})
