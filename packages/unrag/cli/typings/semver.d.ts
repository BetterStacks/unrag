declare module 'semver' {
	export interface SemVer {
		version: string
	}

	/**
	 * Returns the minimum SemVer that satisfies a range, or null when it can't be determined.
	 */
	export function minVersion(range: string): SemVer | null

	/**
	 * True when v1 >= v2.
	 */
	export function gte(
		v1: string | SemVer,
		v2: string | SemVer,
		optionsOrLoose?: unknown
	): boolean
}
