export function normalizeMediaType(
	mediaType: string | undefined
): string | undefined {
	if (!mediaType) {
		return undefined
	}
	return mediaType.split(';')[0]?.trim().toLowerCase() || undefined
}

export function extFromFilename(
	filename: string | undefined
): string | undefined {
	if (!filename) {
		return undefined
	}
	const idx = filename.lastIndexOf('.')
	if (idx < 0) {
		return undefined
	}
	const ext = filename
		.slice(idx + 1)
		.trim()
		.toLowerCase()
	return ext || undefined
}
