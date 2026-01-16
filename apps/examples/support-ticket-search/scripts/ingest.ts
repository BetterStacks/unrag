import {db, pool, schema} from '../db'
import {createUnragEngine} from '../unrag.config'
import {eq} from 'drizzle-orm'

async function ingest() {
	console.log('Ingesting support tickets into vector store...\n')

	const engine = createUnragEngine()

	// Get all tickets from the database
	const tickets = await db.select().from(schema.supportTickets)
	console.log(`Found ${tickets.length} tickets to ingest.\n`)

	let successCount = 0
	let errorCount = 0

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
			process.stdout.write(
				`\rIngested ${successCount}/${tickets.length} tickets...`
			)
		} catch (error) {
			errorCount++
			console.error(`\nFailed to ingest ticket ${ticket.id}:`, error)
		}
	}

	console.log(`\n\nIngest completed!`)
	console.log(`  Success: ${successCount}`)
	console.log(`  Errors: ${errorCount}`)

	// Verify chunks created
	const chunkCount = await db
		.select()
		.from(schema.chunks)
		.then((rows) => rows.length)
	console.log(`\nTotal chunks in database: ${chunkCount}`)
}

ingest()
	.catch((error) => {
		console.error('Ingest failed:', error)
		process.exit(1)
	})
	.finally(() => {
		pool.end()
	})
