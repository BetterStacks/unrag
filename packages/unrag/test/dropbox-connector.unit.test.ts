import {afterEach, describe, expect, test} from 'bun:test'
import {getDropboxAccessToken} from '@registry/connectors/dropbox/client'
import {dropboxConnector} from '@registry/connectors/dropbox/sync'

describe('dropbox connector: auth validation', () => {
	test('access token returns token', async () => {
		await expect(
			getDropboxAccessToken({
				kind: 'access_token',
				accessToken: 'token'
			})
		).resolves.toBe('token')
	})

	test('refresh token requires fields', async () => {
		await expect(
			getDropboxAccessToken({
				kind: 'oauth_refresh_token',
				clientId: '',
				clientSecret: '',
				refreshToken: ''
			})
		).rejects.toThrow()
	})
})

describe('dropbox connector: deleteOnRemoved behavior', () => {
	const originalFetch = globalThis.fetch

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('emits delete events when deleteOnRemoved=true', async () => {
		globalThis.fetch = (async (url: RequestInfo) => {
			const u = String(url)
			if (u.includes('/files/list_folder')) {
				return new Response(
					JSON.stringify({
						entries: [{'.tag': 'deleted', path_lower: '/kb/a.txt'}],
						cursor: 'c1',
						has_more: false
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
		const stream = dropboxConnector.streamFolder({
			auth: {kind: 'access_token', accessToken: 'x'},
			folderPath: '/kb',
			options: {deleteOnRemoved: true}
		})

		for await (const event of stream) {
			events.push({type: event.type})
		}

		expect(events.some((e) => e.type === 'delete')).toBe(true)
	})
})
