import type {DeepPartial} from '@registry/core/types'

/**
 * Type guard to check if a value is a plain object (not array, not null).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Deep merge utility that recursively merges overrides into base.
 * Arrays are replaced, not merged. Undefined values in overrides are skipped.
 */
export function mergeDeep<T extends Record<string, unknown>>(
	base: T,
	overrides: DeepPartial<T> | undefined
): T {
	if (!overrides) return base

	const out = (Array.isArray(base) ? [...base] : {...base}) as T

	for (const key of Object.keys(overrides) as Array<keyof T>) {
		const nextVal = overrides[key as keyof typeof overrides]
		if (nextVal === undefined) continue

		const baseVal = base[key]

		if (
			isRecord(baseVal) &&
			isRecord(nextVal) &&
			!Array.isArray(baseVal) &&
			!Array.isArray(nextVal)
		) {
			out[key] = mergeDeep(
				baseVal,
				nextVal as DeepPartial<typeof baseVal>
			) as T[keyof T]
		} else {
			out[key] = nextVal as T[keyof T]
		}
	}

	return out
}
