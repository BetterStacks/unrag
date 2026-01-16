/**
 * Rate Limiting Middleware
 *
 * This proxy uses Upstash Redis to rate limit API requests.
 * It's completely optional - if UPSTASH_REDIS_REST_URL is not set,
 * rate limiting is disabled and all requests pass through.
 *
 * To remove rate limiting entirely, simply delete this file.
 *
 * Setup:
 * 1. Create a free Redis database at https://upstash.com
 * 2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env
 *
 * Or use Vercel KV:
 * 1. Go to Vercel Dashboard -> Storage -> Create KV Database
 * 2. Environment variables are auto-added
 */

import {Ratelimit} from '@upstash/ratelimit'
import {Redis} from '@upstash/redis'
import {NextRequest, NextResponse} from 'next/server'

// Initialize Redis client only if configured
const redis =
	process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
		? new Redis({
				url: process.env.UPSTASH_REDIS_REST_URL,
				token: process.env.UPSTASH_REDIS_REST_TOKEN
			})
		: null

// Rate limiters with different limits per route type
// Search is more expensive (embeddings + optional rerank), so stricter limit
const rateLimiters = redis
	? {
			search: new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 searches per minute
				analytics: true,
				prefix: 'ratelimit:search'
			}),
			default: new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(30, '60 s'), // 30 requests per minute
				analytics: true,
				prefix: 'ratelimit:default'
			})
		}
	: null

// CORS headers to allow all origins
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function proxy(request: NextRequest) {
	// Only apply to API routes
	if (!request.nextUrl.pathname.startsWith('/api')) {
		return NextResponse.next()
	}

	// Handle preflight requests
	if (request.method === 'OPTIONS') {
		return new NextResponse(null, {
			status: 200,
			headers: corsHeaders
		})
	}

	// Skip rate limiting if not configured
	if (!rateLimiters) {
		const response = NextResponse.next()
		Object.entries(corsHeaders).forEach(([key, value]) => {
			response.headers.set(key, value)
		})
		return response
	}

	// Get client IP for rate limiting
	const ip =
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		request.headers.get('x-real-ip') ??
		'127.0.0.1'

	// Select rate limiter based on route
	const isSearchRoute = request.nextUrl.pathname === '/api/search'
	const limiter = isSearchRoute ? rateLimiters.search : rateLimiters.default

	try {
		const {success, limit, reset, remaining} = await limiter.limit(ip)

		// Rate limit exceeded
		if (!success) {
			return NextResponse.json(
				{
					error: 'Too many requests',
					message: 'Please try again later.',
					retryAfter: Math.ceil((reset - Date.now()) / 1000)
				},
				{
					status: 429,
					headers: {
						...corsHeaders,
						'X-RateLimit-Limit': limit.toString(),
						'X-RateLimit-Remaining': '0',
						'X-RateLimit-Reset': reset.toString(),
						'Retry-After': Math.ceil(
							(reset - Date.now()) / 1000
						).toString()
					}
				}
			)
		}

		// Add rate limit headers and CORS headers to successful responses
		const response = NextResponse.next()
		Object.entries(corsHeaders).forEach(([key, value]) => {
			response.headers.set(key, value)
		})
		response.headers.set('X-RateLimit-Limit', limit.toString())
		response.headers.set('X-RateLimit-Remaining', remaining.toString())
		response.headers.set('X-RateLimit-Reset', reset.toString())

		return response
	} catch (error) {
		// If rate limiting fails, allow the request through
		// This prevents Redis outages from breaking the app
		console.error('[rate-limit] Error:', error)
		const response = NextResponse.next()
		Object.entries(corsHeaders).forEach(([key, value]) => {
			response.headers.set(key, value)
		})
		return response
	}
}

export const config = {
	matcher: '/api/:path*'
}
