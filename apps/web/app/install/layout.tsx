import {Instrument_Serif, Inter} from 'next/font/google'
import type {ReactNode} from 'react'

const inter = Inter({
	subsets: ['latin'],
	variable: '--font-unrag-sans',
	display: 'swap'
})

const instrumentSerif = Instrument_Serif({
	subsets: ['latin'],
	weight: ['400'],
	variable: '--font-unrag-display',
	display: 'swap'
})

export default function InstallLayout({children}: {children: ReactNode}) {
	return (
		<div
			className={`unrag-theme font-sans ${inter.variable} ${instrumentSerif.variable} min-h-screen bg-lemon-50 text-olive-950 dark:bg-lemon-950 dark:text-white`}
		>
			{children}
		</div>
	)
}
