'use client'

import {clsx} from 'clsx/lite'
import Link from 'next/link'
import {type ComponentProps, type ReactNode, useState} from 'react'
import {ButtonLink} from './elements'

function NavbarLink({
	children,
	href,
	className,
	...props
}: {href: string} & Omit<ComponentProps<typeof Link>, 'href'>) {
	return (
		<Link
			href={href}
			className={clsx(
				'group inline-flex items-center justify-between gap-2 text-3xl/10 font-medium text-olive-950 lg:text-sm/7 dark:text-white',
				className
			)}
			{...props}
		>
			{children}
			<span
				className="inline-flex p-1.5 opacity-0 group-hover:opacity-100 lg:hidden"
				aria-hidden="true"
			>
				<svg
					fill="none"
					viewBox="0 0 24 24"
					strokeWidth={1.5}
					stroke="currentColor"
					className="size-6"
				>
					<title>Chevron</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="m8.25 4.5 7.5 7.5-7.5 7.5"
					/>
				</svg>
			</span>
		</Link>
	)
}

function NavbarLogo({
	className,
	href,
	...props
}: {href: string} & Omit<ComponentProps<typeof Link>, 'href'>) {
	return (
		<Link
			href={href}
			{...props}
			className={clsx('inline-flex items-stretch', className)}
		/>
	)
}

function NavbarWithLinksActionsAndCenteredLogo({
	links,
	logo,
	actions,
	className,
	...props
}: {
	links: ReactNode
	logo: ReactNode
	actions: ReactNode
} & ComponentProps<'header'>) {
	const [menuOpen, setMenuOpen] = useState(false)

	return (
		<header
			className={clsx(
				'sticky top-0 z-10 bg-lemon-50 dark:bg-lemon-950',
				className
			)}
			{...props}
		>
			<style>{':root { --scroll-padding-top: 3.5rem }'}</style>
			<nav>
				<div className="mx-auto flex h-(--scroll-padding-top) max-w-7xl items-center gap-4 px-6 lg:px-10">
					<div className="flex items-center">{logo}</div>
					<div className="flex flex-1 items-center justify-end gap-4">
						<div className="flex shrink-0 items-center gap-5">
							<div className="flex flex-1 gap-8 max-lg:hidden">
								{links}
							</div>
							{actions}
						</div>

						<button
							type="button"
							aria-label="Toggle menu"
							aria-expanded={menuOpen}
							aria-controls="mobile-menu"
							onClick={() => setMenuOpen(true)}
							className="inline-flex rounded-full p-1.5 text-olive-950 hover:bg-lemon-950/10 lg:hidden dark:text-white dark:hover:bg-white/10"
						>
							<svg
								viewBox="0 0 24 24"
								fill="currentColor"
								className="size-6"
							>
								<title>Menu</title>
								<path
									fillRule="evenodd"
									d="M3.748 8.248a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75ZM3.748 15.75a.75.75 0 0 1 .75-.751h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75Z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
					</div>
				</div>

				{menuOpen && (
					<div className="fixed inset-0 z-50 lg:hidden">
						<dialog
							id="mobile-menu"
							open
							aria-modal="true"
							aria-label="Mobile menu"
							className="fixed inset-0 bg-lemon-100 px-6 py-6 lg:px-10 dark:bg-lemon-950"
						>
							<div className="flex justify-end">
								<button
									type="button"
									aria-label="Toggle menu"
									onClick={() => setMenuOpen(false)}
									className="inline-flex rounded-full p-1.5 text-olive-950 hover:bg-lemon-950/10 dark:text-white dark:hover:bg-white/10"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth={1.5}
										stroke="currentColor"
										className="size-6"
									>
										<title>Close</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M6 18 18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
							<div className="mt-6 flex flex-col gap-6">
								{links}
							</div>
						</dialog>
					</div>
				)}
			</nav>
		</header>
	)
}

export function HomeNavbar() {
	return (
		<NavbarWithLinksActionsAndCenteredLogo
			id="navbar"
			links={
				<>
					<NavbarLink href="/docs/rag">Handbook</NavbarLink>
					<NavbarLink href="/docs/changelog">Changelog</NavbarLink>
					<NavbarLink href="/docs">Docs</NavbarLink>
				</>
			}
			logo={
				<NavbarLogo href="/">
					<img
						src="/logo.svg"
						alt="Unrag"
						className="dark:hidden brightness-0"
						width={85}
						height={28}
					/>
					<img
						src="/logo.svg"
						alt="Unrag"
						className="not-dark:hidden"
						width={85}
						height={28}
					/>
				</NavbarLogo>
			}
			actions={<ButtonLink href="/install">Get started</ButtonLink>}
		/>
	)
}
