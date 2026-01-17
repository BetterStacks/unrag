import type {MetadataRoute} from 'next'
import {getSiteUrl} from '@/lib/sitemap-utils'

/**
 * Generates the robots.txt file for the site.
 *
 * Allows all crawlers to access the documentation while
 * explicitly disallowing:
 * - API routes (internal functionality)
 * - LLM text file (intended for AI consumption, not search)
 * - OG image routes (dynamic image generation)
 */
export default function robots(): MetadataRoute.Robots {
	const siteUrl = getSiteUrl()

	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: ['/api/', '/llms-full.txt', '/og/']
			}
		],
		sitemap: `${siteUrl}/sitemap.xml`
	}
}
