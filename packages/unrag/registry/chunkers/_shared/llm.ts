import {generateText} from 'ai'

const DEFAULT_LLM_MODEL = 'openai/gpt-5-mini'

const extractJsonArray = (raw: string): string[] | null => {
	const start = raw.indexOf('[')
	const end = raw.lastIndexOf(']')
	if (start < 0 || end <= start) {
		return null
	}

	try {
		const parsed = JSON.parse(raw.slice(start, end + 1))
		if (!Array.isArray(parsed)) {
			return null
		}
		if (parsed.some((item) => typeof item !== 'string')) {
			return null
		}
		return parsed as string[]
	} catch {
		return null
	}
}

export async function splitWithLlm(args: {
	content: string
	model?: string
	chunkSize: number
	goal: string
}): Promise<string[] | null> {
	const model = args.model?.trim() || DEFAULT_LLM_MODEL

	try {
		const result = await generateText({
			model,
			messages: [
				{
					role: 'system',
					content:
						'You are a document chunking tool. Return ONLY a JSON array of strings.'
				},
				{
					role: 'user',
					content: [
						'Split the input into an ordered JSON array of strings.',
						'Rules:',
						'- Each element must be a contiguous substring of the input.',
						'- Preserve text exactly (no edits, no normalization).',
						'- The array must cover the entire input with no gaps or overlaps.',
						'- Avoid empty strings.',
						`- Keep chunks roughly under ${args.chunkSize} tokens when possible.`,
						`Goal: ${args.goal}`,
						'Return JSON only.'
					].join('\n')
				},
				{role: 'user', content: args.content}
			]
		})

		const parsed = extractJsonArray(result.text ?? '')
		if (!parsed || parsed.length === 0) {
			return null
		}

		if (parsed.some((item) => item.length === 0)) {
			return null
		}

		const combined = parsed.join('')
		if (combined !== args.content) {
			return null
		}

		return parsed
	} catch {
		return null
	}
}
