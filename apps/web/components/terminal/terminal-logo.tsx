'use client'

import Image from 'next/image'

export function TerminalLogo() {
	return (
		<div className="px-4 py-12 overflow-hidden flex justify-center">
			<Image src="/unrag.svg" alt="Unrag" width={400} height={250} />
		</div>
	)
}
