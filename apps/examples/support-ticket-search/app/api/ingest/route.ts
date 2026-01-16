import {db, schema} from '@/db'
import {createUnragEngine} from '@/unrag.config'
import {type NextRequest, NextResponse} from 'next/server'

export async function POST(_request: NextRequest) {
	try {
		const engine = createUnragEngine()

		// Get all tickets from the database
		const tickets = await db.select().from(schema.supportTickets)

		if (tickets.length === 0) {
			return NextResponse.json(
				{
					error: "No tickets found. Run 'bun run seed' first."
				},
				{status: 400}
			)
		}

		let successCount = 0
		let errorCount = 0
		const errors: string[] = []

		for (const ticket of tickets) {
			try {
				// Combine ticket content for embedding
				const contentParts = [
					`Title: ${ticket.title}`,
					`Category: ${ticket.category}`,
					`Priority: ${ticket.priority}`,
					`Status: ${ticket.status}`,
					`Description: ${ticket.description}`
				]

				if (ticket.resolution) {
					contentParts.push(`Resolution: ${ticket.resolution}`)
				}

				if (ticket.tags && ticket.tags.length > 0) {
					contentParts.push(`Tags: ${ticket.tags.join(', ')}`)
				}

				const content = contentParts.join('\n\n')

				// Ingest into unrag
				await engine.ingest({
					sourceId: `ticket:${ticket.id}`,
					content,
					metadata: {
						ticketId: ticket.id,
						title: ticket.title,
						category: ticket.category,
						priority: ticket.priority,
						status: ticket.status,
						customerEmail: ticket.customerEmail,
						tags: ticket.tags,
						createdAt: ticket.createdAt.toISOString()
					}
				})

				successCount++
			} catch (error) {
				errorCount++
				errors.push(
					`Ticket ${ticket.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
				)
			}
		}

		return NextResponse.json({
			message: 'Ingest completed',
			success: successCount,
			errors: errorCount,
			errorDetails: errors.length > 0 ? errors : undefined
		})
	} catch (error) {
		console.error('Ingest failed:', error)
		return NextResponse.json({error: 'Ingest failed'}, {status: 500})
	}
}
