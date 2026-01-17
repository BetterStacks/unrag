/**
 * Public URLs that the CLI can print.
 *
 * These must be stable for users running the published `unrag` package
 * (i.e. they cannot rely on monorepo-only imports like `apps/web/*`).
 */

export const UNRAG_SITE_URL =
	(process.env.UNRAG_SITE_URL ?? process.env.UNRAG_DOCS_BASE_URL)?.trim() ||
	'https://unrag.dev'

export const UNRAG_GITHUB_REPO_URL = 'https://github.com/BetterStacks/unrag'

/**
 * Build a fully-qualified docs URL for a given site-relative pathname.
 *
 * Examples:
 * - docsUrl("/docs/reference/cli") -> "https://unrag.dev/docs/reference/cli"
 * - docsUrl("docs/connectors/notion") -> "https://unrag.dev/docs/connectors/notion"
 */
export function docsUrl(siteRelativePath: string): string {
	const p = siteRelativePath.startsWith('/')
		? siteRelativePath
		: `/${siteRelativePath}`

	// Ensure the base ends with a slash so `new URL()` treats the second arg as a base.
	const base = UNRAG_SITE_URL.endsWith('/')
		? UNRAG_SITE_URL
		: `${UNRAG_SITE_URL}/`
	return new URL(p.replace(/^\/+/, '/'), base).toString()
}
