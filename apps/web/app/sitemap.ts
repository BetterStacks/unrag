import type {MetadataRoute} from 'next'
import {source} from '@/lib/source'
import {
	getChangeFrequencyForPath,
	getPriorityForPath,
	getSiteUrl,
	STATIC_PAGES
} from '@/lib/sitemap-utils'

/**
 * Force static generation at build time.
 * The sitemap is regenerated on each deployment.
 */
export const dynamic = 'force-static'

/**
 * Revalidation is disabled since we use static generation.
 * The sitemap updates with each build.
 */
export const revalidate = false

/**
 * Generates the sitemap for the entire documentation site.
 *
 * Includes:
 * - Static pages (/, /install)
 * - All dynamically generated MDX documentation pages
 *
 * Excludes:
 * - API routes (/api/*)
 * - LLM text file (/llms-full.txt)
 * - OG image routes (/og/*)
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const siteUrl = getSiteUrl()
	const buildDate = new Date()

	const sitemapEntries: MetadataRoute.Sitemap = []

	// 1. Add static pages
	for (const staticPage of STATIC_PAGES) {
		const url = `${siteUrl}${staticPage.path === '/' ? '' : staticPage.path}`
		sitemapEntries.push({
			url,
			lastModified: staticPage.lastModified ?? buildDate,
			changeFrequency: getChangeFrequencyForPath(staticPage.path),
			priority: getPriorityForPath(staticPage.path)
		})
	}

	// 2. Add all documentation pages from Fumadocs source
	const pages = source.getPages()

	for (const page of pages) {
		const url = `${siteUrl}${page.url}`

		sitemapEntries.push({
			url,
			lastModified: buildDate,
			changeFrequency: getChangeFrequencyForPath(page.url),
			priority: getPriorityForPath(page.url)
		})
	}

	// 3. Sort entries: homepage first, then by priority (descending), then alphabetically
	sitemapEntries.sort((a, b) => {
		const aIsRoot = new URL(a.url).pathname === '/'
		const bIsRoot = new URL(b.url).pathname === '/'

		// Homepage always first
		if (aIsRoot && !bIsRoot) return -1
		if (!aIsRoot && bIsRoot) return 1

		// Then by priority (higher first)
		const priorityDiff = (b.priority ?? 0.5) - (a.priority ?? 0.5)
		if (priorityDiff !== 0) return priorityDiff

		// Finally alphabetically
		return a.url.localeCompare(b.url)
	})

	return sitemapEntries
}
