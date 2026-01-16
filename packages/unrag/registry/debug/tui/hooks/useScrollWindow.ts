import {clamp} from '@registry/debug/tui/theme'
import {useEffect, useMemo, useState} from 'react'

/**
 * Keeps a scroll window aligned such that the selected index stays visible.
 * Returns the current scrollTop and the [start,end) window bounds.
 */
export function useScrollWindow(args: {
	itemCount: number
	selectedIndex: number
	/** How many rows you intend to render for the list. */
	viewportRows: number
	/** Optional: reset scrollTop when these change (e.g. filter/paging). */
	resetKey?: string | number
}) {
	const {itemCount, selectedIndex, viewportRows, resetKey} = args
	const safeViewport = Math.max(1, viewportRows)
	const maxTop = Math.max(0, itemCount - safeViewport)
	const [scrollTop, setScrollTop] = useState(0)

	// Reset hook for filters/paging.
	useEffect(() => {
		if (resetKey === undefined) {
			return
		}
		setScrollTop(0)
	}, [resetKey])

	// Keep scrollTop in bounds when itemCount/viewport changes.
	useEffect(() => {
		setScrollTop((t) => clamp(t, 0, maxTop))
	}, [maxTop])

	// Ensure selection is visible.
	useEffect(() => {
		setScrollTop((t) => {
			const idx = clamp(selectedIndex, 0, Math.max(0, itemCount - 1))
			if (idx < t) {
				return idx
			}
			if (idx >= t + safeViewport) {
				return clamp(idx - safeViewport + 1, 0, maxTop)
			}
			return clamp(t, 0, maxTop)
		})
	}, [itemCount, selectedIndex, safeViewport, maxTop])

	const windowStart = scrollTop
	const windowEnd = Math.min(itemCount, scrollTop + safeViewport)

	const meta = useMemo(() => {
		return {
			windowStart,
			windowEnd,
			hasAbove: windowStart > 0,
			hasBelow: windowEnd < itemCount,
			aboveCount: windowStart,
			belowCount: Math.max(0, itemCount - windowEnd)
		}
	}, [itemCount, windowEnd, windowStart])

	return {scrollTop, setScrollTop, ...meta}
}
