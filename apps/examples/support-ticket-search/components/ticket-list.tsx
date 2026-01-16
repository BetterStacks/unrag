import type {SupportTicket} from '@/db/schema'
import {TicketCard} from './ticket-card'

interface TicketListProps {
	tickets: SupportTicket[]
}

export function TicketList({tickets}: TicketListProps) {
	if (tickets.length === 0) {
		return (
			<div className="text-muted-foreground py-12 text-center text-sm">
				No tickets found
			</div>
		)
	}

	return (
		<div className="space-y-3">
			{tickets.map((ticket) => (
				<TicketCard key={ticket.id} ticket={ticket} />
			))}
		</div>
	)
}
