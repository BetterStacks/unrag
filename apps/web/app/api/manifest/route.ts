import {NextResponse} from 'next/server'
import {loadRegistryManifest} from '../_lib/registry-manifest'

export async function GET() {
	try {
		const manifest = await loadRegistryManifest()
		return NextResponse.json(manifest, {
			headers: {
				'Cache-Control':
					'public, max-age=300, stale-while-revalidate=3600'
			}
		})
	} catch {
		return NextResponse.json(
			{error: 'Failed to load manifest'},
			{status: 500}
		)
	}
}
