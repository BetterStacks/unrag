import type {MetadataRoute} from 'next'

/**
 * Site configuration for sitemap generation.
 * Uses the same URL resolution pattern as the root layout.
 */
export function getSiteUrl(): string {
	return (
		process.env.NEXT_PUBLIC_SITE_URL ??
		(process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}`
			: 'http://localhost:3000')
	)
}

/**
 * Priority values based on page type and hierarchy.
 * Higher values indicate more important pages to crawlers.
 */
export const SITEMAP_PRIORITIES = {
	homepage: 1.0,
	install: 0.9,
	docsRoot: 0.9,
	gettingStarted: 0.85,
	concepts: 0.8,
	guides: 0.8,
	reference: 0.75,
	changelog: 0.6,
	default: 0.7
} as const

/**
 * Change frequency hints for different page types.
 * These are advisory only - crawlers may ignore them.
 */
export const CHANGE_FREQUENCIES = {
	homepage: 'weekly',
	install: 'weekly',
	docsRoot: 'weekly',
	changelog: 'daily',
	default: 'monthly'
} as const satisfies Record<
	string,
	NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
>

/**
 * Determines priority based on the page's URL path.
 * Documentation pages are prioritized by section.
 */
export function getPriorityForPath(urlPath: string): number {
	if (urlPath === '/') {
		return SITEMAP_PRIORITIES.homepage
	}
	if (urlPath === '/install') {
		return SITEMAP_PRIORITIES.install
	}
	if (urlPath === '/docs') {
		return SITEMAP_PRIORITIES.docsRoot
	}

	if (urlPath.startsWith('/docs/getting-started')) {
		return SITEMAP_PRIORITIES.gettingStarted
	}
	if (urlPath.startsWith('/docs/concepts')) {
		return SITEMAP_PRIORITIES.concepts
	}
	if (urlPath.startsWith('/docs/guides')) {
		return SITEMAP_PRIORITIES.guides
	}
	if (urlPath.startsWith('/docs/reference')) {
		return SITEMAP_PRIORITIES.reference
	}
	if (urlPath.startsWith('/docs/changelog')) {
		return SITEMAP_PRIORITIES.changelog
	}

	return SITEMAP_PRIORITIES.default
}

/**
 * Determines change frequency based on the page's URL path.
 */
export function getChangeFrequencyForPath(
	urlPath: string
): NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']> {
	if (urlPath === '/') {
		return CHANGE_FREQUENCIES.homepage
	}
	if (urlPath === '/install') {
		return CHANGE_FREQUENCIES.install
	}
	if (urlPath === '/docs') {
		return CHANGE_FREQUENCIES.docsRoot
	}
	if (urlPath.includes('/changelog')) {
		return CHANGE_FREQUENCIES.changelog
	}

	return CHANGE_FREQUENCIES.default
}

/**
 * Static pages that are manually maintained (not from MDX).
 * Add new static pages here as they are created.
 */
export const STATIC_PAGES: Array<{
	path: string
	lastModified?: Date
}> = [{path: '/'}, {path: '/install'}]
