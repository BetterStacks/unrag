import {NextResponse, type NextRequest} from 'next/server'
import {redis} from '../../_lib/redis'

function isSafeId(id: string) {
	return /^[a-zA-Z0-9_-]{6,64}$/.test(id)
}

export async function GET(
	_req: NextRequest,
	{params}: {params: Promise<{id: string}>}
) {
	const {id} = await params
	if (!isSafeId(id)) {
		return NextResponse.json({error: 'Invalid preset id'}, {status: 400})
	}

	const key = `unrag:preset:${id}`
	const preset = await redis.get(key)
	if (!preset) {
		return NextResponse.json({error: 'Preset not found'}, {status: 404})
	}

	return NextResponse.json(preset, {
		headers: {
			'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
		}
	})
}
