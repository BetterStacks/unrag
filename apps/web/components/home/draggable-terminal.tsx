'use client'

import {cn} from '@/lib/utils'
import {motion, useMotionValue} from 'motion/react'
import type {ComponentProps, PointerEventHandler} from 'react'
import {useCallback, useRef, useState} from 'react'
import {Terminal} from '../terminal'

type DraggableTerminalProps = Omit<
	ComponentProps<typeof Terminal>,
	'onTitleBarPointerDown'
>

export function DraggableTerminal({
	className,
	...props
}: DraggableTerminalProps) {
	const dragX = useMotionValue(0)
	const dragY = useMotionValue(0)
	const dragStateRef = useRef<{
		startX: number
		startY: number
		startDragX: number
		startDragY: number
	} | null>(null)
	const resizeStateRef = useRef<{
		startX: number
		startY: number
		startWidth: number
		startHeight: number
		startDragX: number
		startDragY: number
		edges: {
			left: boolean
			right: boolean
			top: boolean
			bottom: boolean
		}
	} | null>(null)
	const [size, setSize] = useState<{width: number; height: number} | null>(
		null
	)

	const minWidth = 320
	const minHeight = 360
	const isResized = size !== null

	const handleDragPointerMove = useCallback(
		(event: PointerEvent) => {
			const state = dragStateRef.current
			if (!state) {
				return
			}
			dragX.set(state.startDragX + (event.clientX - state.startX))
			dragY.set(state.startDragY + (event.clientY - state.startY))
		},
		[dragX, dragY]
	)

	const handleDragPointerUp = useCallback(() => {
		dragStateRef.current = null
		window.removeEventListener('pointermove', handleDragPointerMove)
		window.removeEventListener('pointerup', handleDragPointerUp)
		window.removeEventListener('pointercancel', handleDragPointerUp)
	}, [handleDragPointerMove])

	const handleTitleBarPointerDown: PointerEventHandler<HTMLDivElement> = (
		event
	) => {
		event.preventDefault()
		dragStateRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			startDragX: dragX.get(),
			startDragY: dragY.get()
		}
		window.addEventListener('pointermove', handleDragPointerMove)
		window.addEventListener('pointerup', handleDragPointerUp)
		window.addEventListener('pointercancel', handleDragPointerUp)
	}

	const handleResizePointerDown =
		(edges: {
			left: boolean
			right: boolean
			top: boolean
			bottom: boolean
		}): PointerEventHandler<HTMLButtonElement> =>
		(event) => {
			event.preventDefault()
			event.stopPropagation()
			const node = event.currentTarget
			const container = node.closest('[data-draggable-terminal="true"]')
			if (!(container instanceof HTMLElement)) {
				return
			}
			const rect = container.getBoundingClientRect()
			resizeStateRef.current = {
				startX: event.clientX,
				startY: event.clientY,
				startWidth: rect.width,
				startHeight: rect.height,
				startDragX: dragX.get(),
				startDragY: dragY.get(),
				edges
			}
			setSize({width: rect.width, height: rect.height})
			node.setPointerCapture(event.pointerId)
		}

	const handleResizePointerMove: PointerEventHandler<HTMLButtonElement> = (
		event
	) => {
		const state = resizeStateRef.current
		if (!state) {
			return
		}
		const deltaX = event.clientX - state.startX
		const deltaY = event.clientY - state.startY

		const widthFromRight = state.edges.right
			? state.startWidth + deltaX
			: state.startWidth
		const widthFromLeft = state.edges.left
			? state.startWidth - deltaX
			: widthFromRight
		const nextWidth = Math.max(minWidth, widthFromLeft)

		const heightFromBottom = state.edges.bottom
			? state.startHeight + deltaY
			: state.startHeight
		const heightFromTop = state.edges.top
			? state.startHeight - deltaY
			: heightFromBottom
		const nextHeight = Math.max(minHeight, heightFromTop)

		if (state.edges.left) {
			const appliedDelta = state.startWidth - nextWidth
			dragX.set(state.startDragX + appliedDelta)
		}
		if (state.edges.top) {
			const appliedDelta = state.startHeight - nextHeight
			dragY.set(state.startDragY + appliedDelta)
		}

		setSize({width: nextWidth, height: nextHeight})
	}

	const handleResizePointerUp: PointerEventHandler<HTMLButtonElement> = (
		event
	) => {
		resizeStateRef.current = null
		event.currentTarget.releasePointerCapture(event.pointerId)
	}

	return (
		<motion.div
			data-draggable-terminal="true"
			className="absolute left-0 top-0"
			style={
				isResized
					? {
							width: size.width,
							height: size.height,
							x: dragX,
							y: dragY
						}
					: {width: '100%', height: '100%', x: dragX, y: dragY}
			}
		>
			<Terminal
				className={cn('w-full h-full max-h-none', className)}
				onTitleBarPointerDown={handleTitleBarPointerDown}
				resizable
				{...props}
			/>
			<button
				type="button"
				aria-label="Resize terminal from right edge"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: false,
					right: true,
					top: false,
					bottom: false
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute inset-y-0 right-0 w-4 touch-none cursor-ew-resize bg-transparent"
			/>
			<button
				type="button"
				aria-label="Resize terminal from left edge"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: true,
					right: false,
					top: false,
					bottom: false
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute inset-y-0 left-0 w-4 touch-none cursor-ew-resize bg-transparent"
			/>
			<button
				type="button"
				aria-label="Resize terminal from bottom edge"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: false,
					right: false,
					top: false,
					bottom: true
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute inset-x-0 bottom-0 h-4 touch-none cursor-ns-resize bg-transparent"
			/>
			<button
				type="button"
				aria-label="Resize terminal from top edge"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: false,
					right: false,
					top: true,
					bottom: false
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute inset-x-0 top-0 h-4 touch-none cursor-ns-resize bg-transparent"
			/>
			<button
				type="button"
				aria-label="Resize terminal from bottom right corner"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: false,
					right: true,
					top: false,
					bottom: true
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute bottom-0 right-0 size-4 touch-none cursor-nwse-resize bg-transparent"
			/>
			<button
				type="button"
				aria-label="Resize terminal from bottom left corner"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: true,
					right: false,
					top: false,
					bottom: true
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute bottom-0 left-0 size-4 touch-none cursor-nesw-resize bg-transparent"
			/>
			<button
				type="button"
				aria-label="Resize terminal from top right corner"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: false,
					right: true,
					top: true,
					bottom: false
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute top-0 right-0 size-4 touch-none cursor-nesw-resize bg-transparent"
			/>
			<button
				type="button"
				aria-label="Resize terminal from top left corner"
				tabIndex={-1}
				onPointerDown={handleResizePointerDown({
					left: true,
					right: false,
					top: true,
					bottom: false
				})}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerUp}
				onPointerCancel={handleResizePointerUp}
				className="absolute top-0 left-0 size-4 touch-none cursor-nwse-resize bg-transparent"
			/>
		</motion.div>
	)
}
