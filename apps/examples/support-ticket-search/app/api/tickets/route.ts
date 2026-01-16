import {db, schema} from '@/db'
import {desc, eq} from 'drizzle-orm'
import {NextRequest, NextResponse} from 'next/server'

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams
		const category = searchParams.get('category')
		const status = searchParams.get('status')
		const limit = parseInt(searchParams.get('limit') || '50')

		let query = db
			.select()
			.from(schema.supportTickets)
			.orderBy(desc(schema.supportTickets.createdAt))
			.limit(limit)

		const tickets = await query

		// Filter in memory for simplicity (in production, use proper WHERE clauses)
		let filtered = tickets
		if (category) {
			filtered = filtered.filter((t) => t.category === category)
		}
		if (status) {
			filtered = filtered.filter((t) => t.status === status)
		}

		return NextResponse.json({
			tickets: filtered,
			count: filtered.length
		})
	} catch (error) {
		console.error('Failed to fetch tickets:', error)
		return NextResponse.json(
			{error: 'Failed to fetch tickets'},
			{status: 500}
		)
	}
}
