import {createMDX} from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
	reactStrictMode: true,
	async rewrites() {
		return [
			// Example 1: Support Ticket Search
			// The external app doesn't use basePath - we handle the path prefix here
			{
				source: '/example/support-ticket-search',
				destination:
					'https://unrag-example-support-ticket-search.vercel.app'
			},
			{
				source: '/example/support-ticket-search/:path*',
				destination:
					'https://unrag-example-support-ticket-search.vercel.app/:path*'
			}
		]
	}
}

export default withMDX(config)
