'use client'
import {chars, theme} from './terminal-theme'

const mockOperations = [
	{title: 'INGEST', count: 42, lastMs: 156, avgMs: 142},
	{title: 'RETRIEVE', count: 128, lastMs: 23, avgMs: 31},
	{title: 'RERANK', count: 89, lastMs: 45, avgMs: 52},
	{title: 'DELETE', count: 3, lastMs: 12, avgMs: 15}
]

const mockLatencyHistory = [
	42, 38, 45, 52, 48, 35, 41, 39, 56, 62, 48, 44, 38, 42, 51, 47, 39, 36, 44,
	48
]

const mockRecentEvents = [
	{type: 'retrieve:complete', time: '14:23:45', duration: '23ms'},
	{type: 'ingest:complete', time: '14:23:42', duration: '156ms'},
	{type: 'retrieve:complete', time: '14:23:38', duration: '31ms'},
	{type: 'rerank:complete', time: '14:23:35', duration: '45ms'},
	{type: 'retrieve:complete', time: '14:23:30', duration: '28ms'}
]

function SectionHeader({title}: {title: string}) {
	return (
		<div className="mb-2">
			<span className="text-[9px] text-white/40 text-balance sm:text-[10px]">
				{chars.section} {title.toUpperCase()}
			</span>
		</div>
	)
}

function MetricCard({
	title,
	count,
	lastMs,
	avgMs
}: {
	title: string
	count: number
	lastMs: number
	avgMs: number
}) {
	return (
		<div className="flex-1 min-w-0">
			<div className="text-[9px] text-white/50 mb-1 sm:text-[10px]">
				{title}
			</div>
			<div className="text-base font-bold text-white tabular-nums sm:text-lg">
				{count}
			</div>
			<div className="text-[9px] text-white/40 tabular-nums sm:text-[10px]">
				{lastMs}ms last {chars.dot} {avgMs}ms avg
			</div>
		</div>
	)
}

function Sparkline({data}: {data: number[]}) {
	const max = Math.max(...data)
	const min = Math.min(...data)
	const range = max - min || 1

	return (
		<div className="flex items-end gap-px h-5 sm:h-6">
			{data.map((value, idx) => {
				const height = ((value - min) / range) * 100
				return (
					<div
						key={`${idx}-${value}`}
						className="flex-1 rounded-t-sm"
						style={{
							height: `${Math.max(height, 10)}%`,
							backgroundColor: theme.accent,
							opacity: 0.7 + (idx / data.length) * 0.3
						}}
					/>
				)
			})}
		</div>
	)
}

function EventRow({
	type,
	time,
	duration
}: {
	type: string
	time: string
	duration: string
}) {
	const isComplete = type.includes('complete')
	return (
		<div className="flex items-center gap-2 py-0.5 text-[9px] sm:text-[10px]">
			<span style={{color: isComplete ? theme.success : theme.error}}>
				{isComplete ? chars.check : chars.cross}
			</span>
			<span className="text-white/50 tabular-nums">{time}</span>
			<span className="flex-1 truncate text-white/70">{type}</span>
			<span className="text-white/40 tabular-nums">{duration}</span>
		</div>
	)
}

export function TerminalDashboard() {
	return (
		<div className="p-3 h-full overflow-y-auto no-scrollbar sm:p-4">
			{/* Stats row */}
			<div className="mb-4">
				<SectionHeader title="Operations" />
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
					{mockOperations.map((op) => (
						<MetricCard key={op.title} {...op} />
					))}
				</div>
			</div>

			{/* Latency sparkline */}
			<div className="mb-4">
				<SectionHeader title="Latency" />
				<Sparkline data={mockLatencyHistory} />
			</div>

			{/* Recent events */}
			<div>
				<SectionHeader title="Recent Events" />
				<div className="border border-white/20 rounded-sm p-2">
					{mockRecentEvents.map((event) => (
						<EventRow
							key={`${event.type}-${event.time}`}
							{...event}
						/>
					))}
				</div>
			</div>
		</div>
	)
}
