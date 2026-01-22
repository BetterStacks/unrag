import {Tiktoken} from 'js-tiktoken/lite'
import o200k_base from 'js-tiktoken/ranks/o200k_base'

const encoder = new Tiktoken(o200k_base)

export const countTokens = (text: string): number => encoder.encode(text).length

export const getOverlapText = (text: string, overlapTokens: number): string => {
	const tokens = encoder.encode(text)
	if (tokens.length <= overlapTokens) {
		return text
	}

	const overlapTokenSlice = tokens.slice(-overlapTokens)
	try {
		return encoder.decode(overlapTokenSlice)
	} catch {
		return text.slice(-overlapTokens * 4)
	}
}

export const forceSplitByTokens = (
	text: string,
	chunkSize: number,
	chunkOverlap: number
): string[] => {
	const tokens = encoder.encode(text)
	const chunks: string[] = []
	const stride = Math.max(1, chunkSize - chunkOverlap)

	for (let i = 0; i < tokens.length; i += stride) {
		const chunkTokens = tokens.slice(i, i + chunkSize)
		try {
			const chunk = encoder.decode(chunkTokens).trim()
			if (chunk) {
				chunks.push(chunk)
			}
		} catch {
			// Skip invalid token sequences.
		}

		if (i + chunkSize >= tokens.length) {
			break
		}
	}

	return chunks
}

export const mergeSplits = (
	splits: string[],
	chunkSize: number,
	chunkOverlap: number,
	minChunkSize: number
): string[] => {
	const chunks: string[] = []
	let currentChunk = ''
	let currentTokens = 0

	for (const split of splits) {
		const splitTokens = countTokens(split)

		if (splitTokens > chunkSize) {
			if (currentChunk.trim()) {
				if (currentTokens >= minChunkSize) {
					chunks.push(currentChunk.trim())
				} else if (chunks.length > 0) {
					const lastChunk = chunks.pop()
					if (lastChunk) {
						chunks.push((lastChunk + ' ' + currentChunk).trim())
					}
				} else {
					chunks.push(currentChunk.trim())
				}
				currentChunk = ''
				currentTokens = 0
			}

			const forced = forceSplitByTokens(split, chunkSize, chunkOverlap)
			for (const forcedChunk of forced) {
				if (forcedChunk.trim()) {
					chunks.push(forcedChunk.trim())
				}
			}
			continue
		}

		if (currentTokens + splitTokens > chunkSize && currentChunk) {
			if (currentTokens >= minChunkSize) {
				chunks.push(currentChunk.trim())
			}

			if (chunkOverlap > 0 && currentChunk) {
				const overlapText = getOverlapText(currentChunk, chunkOverlap)
				currentChunk = overlapText + split
				currentTokens = countTokens(currentChunk)
			} else {
				currentChunk = split
				currentTokens = splitTokens
			}
		} else {
			currentChunk += split
			currentTokens += splitTokens
		}
	}

	if (currentChunk.trim() && currentTokens >= minChunkSize) {
		chunks.push(currentChunk.trim())
	} else if (currentChunk.trim() && chunks.length > 0) {
		const lastChunk = chunks.pop()
		if (lastChunk) {
			chunks.push((lastChunk + ' ' + currentChunk).trim())
		}
	} else if (currentChunk.trim()) {
		chunks.push(currentChunk.trim())
	}

	return chunks
}
