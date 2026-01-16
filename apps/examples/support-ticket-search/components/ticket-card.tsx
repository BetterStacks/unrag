import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import type {SupportTicket} from '@/db/schema'

interface TicketCardProps {
	ticket: SupportTicket
}

const categoryLabels: Record<string, string> = {
	billing: 'Billing',
	technical: 'Technical',
	account: 'Account',
	feature: 'Feature',
	general: 'General'
}

const priorityLabels: Record<string, string> = {
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	critical: 'Critical'
}

const statusLabels: Record<string, string> = {
	open: 'Open',
	in_progress: 'In Progress',
	resolved: 'Resolved',
	closed: 'Closed'
}

export function TicketCard({ticket}: TicketCardProps) {
	const formattedDate = new Date(ticket.createdAt).toLocaleDateString(
		'en-US',
		{
			month: 'short',
			day: 'numeric'
		}
	)

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle className="truncate">{ticket.title}</CardTitle>
				<CardDescription>
					{ticket.id} · {formattedDate}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<p className="text-muted-foreground line-clamp-2 text-xs">
					{ticket.description}
				</p>
				<div className="flex flex-wrap gap-1.5">
					<Badge variant="secondary">
						{categoryLabels[ticket.category]}
					</Badge>
					<Badge variant="outline">
						{priorityLabels[ticket.priority]}
					</Badge>
					<Badge variant="outline">
						{statusLabels[ticket.status]}
					</Badge>
				</div>
			</CardContent>
		</Card>
	)
}
