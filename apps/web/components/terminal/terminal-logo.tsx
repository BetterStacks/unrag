'use client'

import Image from 'next/image'

export function TerminalLogo() {
	return (
		<div className="flex justify-center overflow-hidden px-4 pb-6 pt-4 sm:pb-12 sm:pt-6">
			<Image
				src="/unrag.svg"
				alt="Unrag"
				width={400}
				height={250}
				className="h-auto w-[220px] sm:w-[400px]"
			/>
		</div>
	)
}
