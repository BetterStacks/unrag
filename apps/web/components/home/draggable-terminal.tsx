'use client'

import type {ComponentProps, PointerEventHandler} from 'react'
import {motion, useDragControls} from 'motion/react'
import {Terminal} from '../terminal'

type DraggableTerminalProps = Omit<
	ComponentProps<typeof Terminal>,
	'onTitleBarPointerDown'
>

export function DraggableTerminal({className, ...props}: DraggableTerminalProps) {
	const dragControls = useDragControls()

	const handleTitleBarPointerDown: PointerEventHandler<HTMLDivElement> = (
		event
	) => {
		event.preventDefault()
		dragControls.start(event)
	}

	return (
		<motion.div
			drag
			dragListener={false}
			dragControls={dragControls}
			dragMomentum={false}
		>
			<Terminal
				className={className}
				onTitleBarPointerDown={handleTitleBarPointerDown}
				{...props}
			/>
		</motion.div>
	)
}
