'use client'

import {useEffect, useRef, useState} from 'react'

export function CopyButton({text}: {text: string}) {
	const [copied, setCopied] = useState(false)
	const resetTimerRef = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (resetTimerRef.current)
				window.clearTimeout(resetTimerRef.current)
		}
	}, [])

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)

			if (resetTimerRef.current)
				window.clearTimeout(resetTimerRef.current)
			resetTimerRef.current = window.setTimeout(() => {
				setCopied(false)
				resetTimerRef.current = null
			}, 1500)
		} catch {
			// If clipboard access fails (permissions, http, etc.), do nothing.
			// We intentionally avoid throwing to keep the UI stable.
		}
	}

	return (
		<button
			className="ml-2 p-1.5 rounded hover:bg-[var(--color-fd-accent)] transition-colors text-[var(--color-fd-muted-foreground)] hover:text-[var(--color-fd-foreground)]"
			onClick={copy}
			title={copied ? 'Copied' : 'Copy to clipboard'}
			aria-label={copied ? 'Copied' : 'Copy to clipboard'}
		>
			{copied ? (
				<svg
					className="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M5 13l4 4L19 7"
					/>
				</svg>
			) : (
				<svg
					className="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
					/>
				</svg>
			)}
		</button>
	)
}
