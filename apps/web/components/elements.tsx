import {clsx} from 'clsx/lite'
import Link from 'next/link'
import type {ComponentProps, ReactNode} from 'react'
import {ChevronIcon} from './icons'

const sizes = {
	md: 'px-3 py-1',
	lg: 'px-4 py-2'
}

export function AnnouncementBadge({
	text,
	href,
	cta = 'Learn more',
	variant = 'normal',
	className,
	...props
}: {
	text: ReactNode
	href: string
	cta?: ReactNode
	variant?: 'normal' | 'overlay'
} & Omit<ComponentProps<typeof Link>, 'href' | 'children'>) {
	return (
		<Link
			href={href}
			{...props}
			data-variant={variant}
			className={clsx(
				'group relative inline-flex max-w-full gap-x-3 overflow-hidden rounded-md px-3.5 py-2 text-sm/6 max-sm:flex-col sm:items-center sm:rounded-full sm:px-3 sm:py-0.5',
				variant === 'normal' &&
					'bg-olive-950/5 text-olive-950 hover:bg-olive-950/10 dark:bg-white/5 dark:text-white dark:inset-ring-1 dark:inset-ring-white/5 dark:hover:bg-white/10',
				variant === 'overlay' &&
					'bg-olive-950/15 text-white hover:bg-olive-950/20 dark:bg-olive-950/20 dark:hover:bg-olive-950/25',
				className
			)}
		>
			<span className="text-pretty sm:truncate">{text}</span>
			<span
				className={clsx(
					'h-3 w-px max-sm:hidden',
					variant === 'normal' && 'bg-olive-950/20 dark:bg-white/10',
					variant === 'overlay' && 'bg-white/20'
				)}
			/>
			<span
				className={clsx(
					'inline-flex shrink-0 items-center gap-2 font-semibold',
					variant === 'normal' && 'text-olive-950 dark:text-white'
				)}
			>
				{cta} <ChevronIcon className="shrink-0" />
			</span>
		</Link>
	)
}

export function Button({
	size = 'md',
	type = 'button',
	color = 'dark/light',
	className,
	...props
}: {
	size?: keyof typeof sizes
	color?: 'dark/light' | 'light'
} & ComponentProps<'button'>) {
	return (
		<button
			type={type}
			className={clsx(
				'inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-sm/7 font-medium',
				color === 'dark/light' &&
					'bg-olive-950 text-white hover:bg-olive-800 dark:bg-olive-300 dark:text-olive-950 dark:hover:bg-olive-200',
				color === 'light' &&
					'hover bg-white text-olive-950 hover:bg-olive-100 dark:bg-olive-100 dark:hover:bg-white',
				sizes[size],
				className
			)}
			{...props}
		/>
	)
}

export function ButtonLink({
	size = 'md',
	color = 'dark/light',
	className,
	href,
	...props
}: {
	href: string
	size?: keyof typeof sizes
	color?: 'dark/light' | 'light'
} & Omit<ComponentProps<typeof Link>, 'href'>) {
	return (
		<Link
			href={href}
			className={clsx(
				'inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-sm/7 font-medium',
				color === 'dark/light' &&
					'bg-olive-950 text-white hover:bg-olive-800 dark:bg-olive-300 dark:text-olive-950 dark:hover:bg-olive-200',
				color === 'light' &&
					'hover bg-white text-olive-950 hover:bg-olive-100 dark:bg-olive-100 dark:hover:bg-white',
				sizes[size],
				className
			)}
			{...props}
		/>
	)
}

export function SoftButton({
	size = 'md',
	type = 'button',
	className,
	...props
}: {
	size?: keyof typeof sizes
} & ComponentProps<'button'>) {
	return (
		<button
			type={type}
			className={clsx(
				'inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-olive-950/10 text-sm/7 font-medium text-olive-950 hover:bg-olive-950/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20',
				sizes[size],
				className
			)}
			{...props}
		/>
	)
}

export function SoftButtonLink({
	size = 'md',
	href,
	className,
	...props
}: {
	href: string
	size?: keyof typeof sizes
} & Omit<ComponentProps<typeof Link>, 'href'>) {
	return (
		<Link
			href={href}
			className={clsx(
				'inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-olive-950/10 text-sm/7 font-medium text-olive-950 hover:bg-olive-950/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20',
				sizes[size],
				className
			)}
			{...props}
		/>
	)
}

export function PlainButton({
	size = 'md',
	color = 'dark/light',
	type = 'button',
	className,
	...props
}: {
	size?: keyof typeof sizes
	color?: 'dark/light' | 'light'
} & ComponentProps<'button'>) {
	return (
		<button
			type={type}
			className={clsx(
				'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm/7 font-medium',
				color === 'dark/light' &&
					'text-olive-950 hover:bg-olive-950/10 dark:text-white dark:hover:bg-white/10',
				color === 'light' &&
					'text-white hover:bg-white/15 dark:hover:bg-white/10',
				sizes[size],
				className
			)}
			{...props}
		/>
	)
}

export function PlainButtonLink({
	size = 'md',
	color = 'dark/light',
	href,
	className,
	...props
}: {
	href: string
	size?: keyof typeof sizes
	color?: 'dark/light' | 'light'
} & Omit<ComponentProps<typeof Link>, 'href'>) {
	return (
		<Link
			href={href}
			className={clsx(
				'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm/7 font-medium',
				color === 'dark/light' &&
					'text-olive-950 hover:bg-olive-950/10 dark:text-white dark:hover:bg-white/10',
				color === 'light' &&
					'text-white hover:bg-white/15 dark:hover:bg-white/10',
				sizes[size],
				className
			)}
			{...props}
		/>
	)
}

export function TextLink({
	href,
	className,
	...props
}: {
	href: string
} & Omit<ComponentProps<typeof Link>, 'href'>) {
	return (
		<Link
			href={href}
			className={clsx(
				'inline-flex items-center gap-2 text-sm/7 font-medium text-olive-950 dark:text-white',
				className
			)}
			{...props}
		/>
	)
}

export function Logo({className, ...props}: ComponentProps<'span'>) {
	return (
		<span
			className={clsx('flex h-8 items-stretch', className)}
			{...props}
		/>
	)
}

export function LogoGrid({className, ...props}: ComponentProps<'div'>) {
	return (
		<div
			className={clsx(
				'mx-auto grid w-full grid-cols-2 place-items-center gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-10 lg:mx-auto lg:inline-grid lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-1 lg:gap-12',
				className
			)}
			{...props}
		/>
	)
}

export function Container({
	children,
	className,
	...props
}: ComponentProps<'div'>) {
	return (
		<div
			className={clsx(
				'mx-auto w-full max-w-2xl px-6 md:max-w-3xl lg:max-w-7xl lg:px-10',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

export function Main({children, className, ...props}: ComponentProps<'main'>) {
	return (
		<main className={clsx('isolate overflow-clip', className)} {...props}>
			{children}
		</main>
	)
}

export function Wallpaper({
	children,
	color,
	className,
	...props
}: {color: 'green' | 'blue' | 'purple' | 'brown'} & ComponentProps<'div'>) {
	const html = String.raw
	const noisePattern = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
		html`
      <svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 100 100">
        <filter id="n">
          <feTurbulence type="turbulence" baseFrequency="1.4" numOctaves="1" seed="2" stitchTiles="stitch" result="n" />
          <feComponentTransfer result="g">
            <feFuncR type="linear" slope="4" intercept="1" />
            <feFuncG type="linear" slope="4" intercept="1" />
            <feFuncB type="linear" slope="4" intercept="1" />
          </feComponentTransfer>
          <feColorMatrix type="saturate" values="0" in="g" />
        </filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>
    `.replace(/\s+/g, ' ')
	)}")`

	return (
		<div
			data-color={color}
			className={clsx(
				'relative overflow-hidden bg-linear-to-b data-[color=blue]:from-[#637c86] data-[color=blue]:to-[#778599] data-[color=brown]:from-[#8d7359] data-[color=brown]:to-[#765959] data-[color=green]:from-[#9ca88f] data-[color=green]:to-[#596352] data-[color=purple]:from-[#7b627d] data-[color=purple]:to-[#8f6976] dark:data-[color=blue]:from-[#243a42] dark:data-[color=blue]:to-[#232f40] dark:data-[color=brown]:from-[#382d23] dark:data-[color=brown]:to-[#3d2323] dark:data-[color=green]:from-[#333a2b] dark:data-[color=green]:to-[#26361b] dark:data-[color=purple]:from-[#412c42] dark:data-[color=purple]:to-[#3c1a26]',
				className
			)}
			{...props}
		>
			<div
				className="absolute inset-0 opacity-30 mix-blend-overlay dark:opacity-25"
				style={{
					backgroundPosition: 'center',
					backgroundImage: noisePattern
				}}
			/>
			<div className="relative">{children}</div>
		</div>
	)
}

export function Screenshot({
	children,
	wallpaper,
	placement,
	className,
	...props
}: {
	wallpaper: 'green' | 'blue' | 'purple' | 'brown'
	placement:
		| 'bottom'
		| 'bottom-left'
		| 'bottom-right'
		| 'top'
		| 'top-left'
		| 'top-right'
} & Omit<ComponentProps<'div'>, 'color'>) {
	return (
		<Wallpaper
			color={wallpaper}
			data-placement={placement}
			className={clsx('group', className)}
			{...props}
		>
			<div className="relative [--padding:min(10%,--spacing(16))] group-data-[placement=bottom]:px-(--padding) group-data-[placement=bottom]:pt-(--padding) group-data-[placement=bottom-left]:pt-(--padding) group-data-[placement=bottom-left]:pr-(--padding) group-data-[placement=bottom-right]:pt-(--padding) group-data-[placement=bottom-right]:pl-(--padding) group-data-[placement=top]:px-(--padding) group-data-[placement=top]:pb-(--padding) group-data-[placement=top-left]:pr-(--padding) group-data-[placement=top-left]:pb-(--padding) group-data-[placement=top-right]:pb-(--padding) group-data-[placement=top-right]:pl-(--padding)">
				<div className="*:relative *:ring-1 *:ring-black/10 group-data-[placement=bottom]:*:rounded-t-sm group-data-[placement=bottom-left]:*:rounded-tr-sm group-data-[placement=bottom-right]:*:rounded-tl-sm group-data-[placement=top]:*:rounded-b-sm group-data-[placement=top-left]:*:rounded-br-sm group-data-[placement=top-right]:*:rounded-bl-sm">
					{children}
				</div>
			</div>
		</Wallpaper>
	)
}

export function Eyebrow({
	children,
	className,
	...props
}: ComponentProps<'div'>) {
	return (
		<div
			className={clsx(
				'text-sm/7 font-semibold text-olive-700 dark:text-olive-400',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

export function Heading({
	children,
	color = 'dark/light',
	className,
	...props
}: {color?: 'dark/light' | 'light'} & ComponentProps<'h1'>) {
	return (
		<h1
			className={clsx(
				'font-display text-5xl/12 tracking-tight text-balance sm:text-[5rem]/20',
				color === 'dark/light' && 'text-olive-950 dark:text-white',
				color === 'light' && 'text-white',
				className
			)}
			{...props}
		>
			{children}
		</h1>
	)
}

export function Text({
	children,
	className,
	size = 'md',
	...props
}: ComponentProps<'div'> & {size?: 'md' | 'lg'}) {
	return (
		<div
			className={clsx(
				size === 'md' && 'text-base/7',
				size === 'lg' && 'text-lg/8',
				'text-olive-700 dark:text-olive-400',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

export function Subheading({
	children,
	className,
	...props
}: ComponentProps<'h2'>) {
	return (
		<h2
			className={clsx(
				'font-display text-[2rem]/10 tracking-tight text-pretty text-olive-950 sm:text-5xl/14 dark:text-white',
				className
			)}
			{...props}
		>
			{children}
		</h2>
	)
}

export function Section({
	eyebrow,
	headline,
	subheadline,
	cta,
	className,
	children,
	...props
}: {
	eyebrow?: ReactNode
	headline?: ReactNode
	subheadline?: ReactNode
	cta?: ReactNode
} & ComponentProps<'section'>) {
	return (
		<section className={clsx('py-16', className)} {...props}>
			<Container className="flex flex-col gap-10 sm:gap-16">
				{headline && (
					<div className="flex max-w-2xl flex-col gap-6">
						<div className="flex flex-col gap-2">
							{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
							<Subheading>{headline}</Subheading>
						</div>
						{subheadline && (
							<Text className="text-pretty">{subheadline}</Text>
						)}
						{cta}
					</div>
				)}
				<div>{children}</div>
			</Container>
		</section>
	)
}
