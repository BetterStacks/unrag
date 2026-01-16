import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
	// Use assetPrefix to load static assets directly from the deployed URL
	// This allows the app to work without basePath while still functioning correctly
	// when proxied through the web app's rewrite rules
	assetPrefix:
		process.env.NODE_ENV === 'production'
			? 'https://unrag-example-support-ticket-search.vercel.app'
			: undefined
}

export default nextConfig
