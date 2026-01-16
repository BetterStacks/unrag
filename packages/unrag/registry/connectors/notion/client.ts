import {Client, type ClientOptions} from '@notionhq/client'

export type NotionClient = Client

export type CreateNotionClientInput = {
	token: string
	timeoutMs?: number
}

/**
 * Extended client options that include timeoutMs (supported by @notionhq/client).
 */
type NotionClientOptions = ClientOptions & {
	timeoutMs?: number
}

export function createNotionClient(
	input: CreateNotionClientInput
): NotionClient {
	const token = input.token?.trim()
	if (!token) {
		throw new Error('NOTION token is required')
	}

	const options: NotionClientOptions = {
		auth: token,
		// @notionhq/client uses undici/fetch under the hood; timeout is supported.
		// If unsupported in a future version, callers can wrap requests.
		timeoutMs: input.timeoutMs ?? 30_000
	}

	return new Client(options)
}
