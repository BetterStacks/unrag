import {describe, expect, test} from 'bun:test'
import {normalizeGoogleDriveAuth} from '@registry/connectors/google-drive/client'
import {
	DRIVE_MIME,
	EXPORT_MIME,
	assetKindFromMediaType,
	classifyDriveMimeType,
	getNativeExportPlan
} from '@registry/connectors/google-drive/mime'
import {buildGoogleDriveFileIngestInput} from '@registry/connectors/google-drive/sync'
import type {GoogleDriveAuth} from '@registry/connectors/google-drive/types'

describe('google-drive connector: mime routing', () => {
	test('classifyDriveMimeType recognizes folders and google-native types', () => {
		expect(classifyDriveMimeType(DRIVE_MIME.folder)).toEqual({
			kind: 'folder'
		})
		expect(classifyDriveMimeType(DRIVE_MIME.shortcut)).toEqual({
			kind: 'shortcut'
		})
		expect(classifyDriveMimeType(DRIVE_MIME.doc)).toEqual({
			kind: 'google_native',
			nativeKind: 'doc'
		})
		expect(classifyDriveMimeType('application/pdf')).toEqual({
			kind: 'binary'
		})
	})

	test('getNativeExportPlan matches the default export strategy', () => {
		expect(getNativeExportPlan('doc')).toEqual({
			kind: 'content',
			mimeType: EXPORT_MIME.text
		})
		expect(getNativeExportPlan('sheet')).toEqual({
			kind: 'content',
			mimeType: EXPORT_MIME.csv
		})
		expect(getNativeExportPlan('slides')).toEqual({
			kind: 'content',
			mimeType: EXPORT_MIME.text
		})
		expect(getNativeExportPlan('drawing')).toEqual({
			kind: 'asset',
			assetKind: 'image',
			mimeType: EXPORT_MIME.png,
			filenameExt: 'png'
		})
	})

	test('assetKindFromMediaType maps common types to asset kinds', () => {
		expect(assetKindFromMediaType('application/pdf')).toBe('pdf')
		expect(assetKindFromMediaType('image/png')).toBe('image')
		expect(assetKindFromMediaType('audio/mpeg')).toBe('audio')
		expect(assetKindFromMediaType('video/mp4')).toBe('video')
		expect(assetKindFromMediaType('application/octet-stream')).toBe('file')
		expect(assetKindFromMediaType(undefined)).toBe('file')
	})
})

describe('google-drive connector: sourceId prefixing', () => {
	test("buildGoogleDriveFileIngestInput joins prefix with a single ':' boundary", () => {
		expect(
			buildGoogleDriveFileIngestInput({
				fileId: 'abc',
				content: 'x',
				sourceIdPrefix: 'tenant:acme:'
			}).sourceId
		).toBe('tenant:acme:gdrive:file:abc')

		expect(
			buildGoogleDriveFileIngestInput({
				fileId: 'abc',
				content: 'x',
				sourceIdPrefix: 'tenant:acme'
			}).sourceId
		).toBe('tenant:acme:gdrive:file:abc')

		expect(
			buildGoogleDriveFileIngestInput({
				fileId: 'abc',
				content: 'x'
			}).sourceId
		).toBe('gdrive:file:abc')
	})
})

describe('google-drive connector: auth normalization', () => {
	test('oauth: accepts oauthClient escape hatch', () => {
		const dummy = {any: 'thing'}
		expect(
			normalizeGoogleDriveAuth({
				kind: 'oauth',
				oauthClient: dummy
			} as unknown as GoogleDriveAuth)
		).toEqual({kind: 'oauth_client', oauthClient: dummy})
	})

	test('oauth: validates required config fields', () => {
		expect(() =>
			normalizeGoogleDriveAuth({
				kind: 'oauth'
			} as unknown as GoogleDriveAuth)
		).toThrow()

		expect(
			normalizeGoogleDriveAuth({
				kind: 'oauth',
				clientId: 'id',
				clientSecret: 'secret',
				redirectUri: 'http://localhost/cb',
				refreshToken: 'rt'
			} as unknown as GoogleDriveAuth)
		).toMatchObject({kind: 'oauth_config'})
	})

	test('service_account: requires client_email + private_key', () => {
		expect(() =>
			normalizeGoogleDriveAuth({
				kind: 'service_account',
				credentialsJson: '{}'
			} as unknown as GoogleDriveAuth)
		).toThrow()

		const json = JSON.stringify({
			client_email: 'svc@example.iam.gserviceaccount.com',
			private_key:
				'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
		})
		expect(
			normalizeGoogleDriveAuth({
				kind: 'service_account',
				credentialsJson: json,
				subject: 'user@company.com'
			} as unknown as GoogleDriveAuth)
		).toEqual({
			kind: 'service_account',
			credentials: {
				client_email: 'svc@example.iam.gserviceaccount.com',
				private_key:
					'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
			},
			subject: 'user@company.com'
		})
	})

	test('google_auth: requires auth instance', () => {
		expect(() =>
			normalizeGoogleDriveAuth({
				kind: 'google_auth'
			} as unknown as GoogleDriveAuth)
		).toThrow()
		expect(
			normalizeGoogleDriveAuth({
				kind: 'google_auth',
				auth: {x: 1}
			} as unknown as GoogleDriveAuth)
		).toEqual({kind: 'google_auth', auth: {x: 1}})
	})
})
