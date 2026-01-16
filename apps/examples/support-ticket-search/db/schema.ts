import {
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	varchar
} from 'drizzle-orm/pg-core'
import * as unrag from '@unrag/store/drizzle/schema'

export const ticketCategory = pgEnum('ticket_category', [
	'billing',
	'technical',
	'account',
	'feature',
	'general'
])

export const ticketPriority = pgEnum('ticket_priority', [
	'low',
	'medium',
	'high',
	'critical'
])

export const ticketStatus = pgEnum('ticket_status', [
	'open',
	'in_progress',
	'resolved',
	'closed'
])

export const supportTickets = pgTable('support_tickets', {
	id: varchar('id', {length: 32}).primaryKey(),
	title: varchar('title', {length: 500}).notNull(),
	description: text('description').notNull(),
	category: ticketCategory('category').notNull(),
	priority: ticketPriority('priority').notNull(),
	status: ticketStatus('status').notNull(),
	resolution: text('resolution'),
	customerEmail: varchar('customer_email', {length: 255}).notNull(),
	tags: text('tags').array(),
	createdAt: timestamp('created_at', {mode: 'date', withTimezone: true})
		.defaultNow()
		.notNull(),
	updatedAt: timestamp('updated_at', {mode: 'date', withTimezone: true})
		.defaultNow()
		.notNull()
})

export const {documents, chunks, embeddings} = unrag

export const schema = {
	supportTickets,
	ticketCategory,
	ticketPriority,
	ticketStatus,
	...unrag.schema
}

export type SupportTicket = typeof supportTickets.$inferSelect
export type NewSupportTicket = typeof supportTickets.$inferInsert
