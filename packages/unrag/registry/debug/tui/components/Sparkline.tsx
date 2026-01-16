/**
 * Sparkline component for displaying mini charts.
 */

import React from 'react'
import {Text} from 'ink'

type SparklineProps = {
	data: number[]
	width?: number
	/** Optional formatter for min/max labels. Defaults to ms formatter. */
	format?: (value: number) => string
	/** Sparkline color (defaults to cyan). */
	color?: string
	/** Show min/max labels (defaults true). */
	showMinMax?: boolean
}

// Unicode block characters for different heights
const BLOCKS = [
	' ',
	'\u2581',
	'\u2582',
	'\u2583',
	'\u2584',
	'\u2585',
	'\u2586',
	'\u2587',
	'\u2588'
]

export function Sparkline({
	data,
	width = 30,
	format,
	color = 'cyan',
	showMinMax = true
}: SparklineProps) {
	if (data.length === 0) {
		return <Text dimColor>No data</Text>
	}

	// Take last 'width' data points
	const displayData = data.slice(-width)

	// Calculate min/max for normalization
	const min = Math.min(...displayData)
	const max = Math.max(...displayData)
	const range = max - min || 1

	// Generate sparkline characters
	const sparkline = displayData
		.map((value) => {
			const normalized = (value - min) / range
			const index = Math.min(
				BLOCKS.length - 1,
				Math.floor(normalized * (BLOCKS.length - 1))
			)
			return BLOCKS[index]
		})
		.join('')

	// Format min/max values
	const formatMs = (ms: number) => {
		if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
		return `${ms.toFixed(0)}ms`
	}
	const fmt = format ?? formatMs
	const minLabel = fmt(min)
	const maxLabel = fmt(max)

	return (
		<Text>
			{showMinMax && <Text dimColor>{minLabel.padStart(6)} </Text>}
			<Text color={color}>{sparkline}</Text>
			{showMinMax && <Text dimColor> {maxLabel}</Text>}
		</Text>
	)
}

export default Sparkline
