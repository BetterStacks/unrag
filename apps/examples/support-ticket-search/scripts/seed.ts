import {db, pool, schema} from '../db'
import {mockTickets} from '../lib/mock-data/tickets'

async function seed() {
	console.log('Seeding database with mock support tickets...\n')

	// Clear existing tickets
	await db.delete(schema.supportTickets)
	console.log('Cleared existing tickets.')

	// Insert mock tickets
	const inserted = await db
		.insert(schema.supportTickets)
		.values(mockTickets)
		.returning({id: schema.supportTickets.id})

	console.log(`Inserted ${inserted.length} support tickets.\n`)

	// Print summary by category
	const categories = mockTickets.reduce(
		(acc, ticket) => {
			acc[ticket.category] = (acc[ticket.category] || 0) + 1
			return acc
		},
		{} as Record<string, number>
	)

	console.log('Tickets by category:')
	Object.entries(categories).forEach(([category, count]) => {
		console.log(`  ${category}: ${count}`)
	})

	// Print summary by status
	const statuses = mockTickets.reduce(
		(acc, ticket) => {
			acc[ticket.status] = (acc[ticket.status] || 0) + 1
			return acc
		},
		{} as Record<string, number>
	)

	console.log('\nTickets by status:')
	Object.entries(statuses).forEach(([status, count]) => {
		console.log(`  ${status}: ${count}`)
	})

	console.log('\nSeed completed successfully!')
}

seed()
	.catch((error) => {
		console.error('Seed failed:', error)
		process.exit(1)
	})
	.finally(() => {
		pool.end()
	})
