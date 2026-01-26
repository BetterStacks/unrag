declare module 'js-tiktoken/lite' {
	/**
	 * `js-tiktoken` ships subpath exports without bundled TS types for some builds.
	 * We keep a minimal declaration here so Unrag can typecheck in-repo.
	 */
	export class Tiktoken {
		constructor(ranks: unknown)
		encode(text: string): number[]
		decode(tokens: number[]): string
	}
}

declare module 'js-tiktoken/ranks/o200k_base' {
	/**
	 * Token rank data for the `o200k_base` encoding.
	 */
	const ranks: unknown
	export default ranks
}

declare module '@prisma/client' {
	/**
	 * In Unrag’s repo we don’t run `prisma generate` as part of typechecking,
	 * so `@prisma/client` types may be absent. Projects using the Prisma adapter
	 * will have real generated types.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: shim for optional generated client
	export class PrismaClient {
		[key: string]: any
	}
}

