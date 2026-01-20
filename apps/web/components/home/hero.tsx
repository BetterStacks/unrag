import {clsx} from 'clsx/lite'
import type {ComponentProps, ReactNode} from 'react'
import {
	AnnouncementBadge,
	ButtonLink,
	Container,
	Heading,
	Logo,
	LogoGrid,
	PlainButtonLink,
	Text
} from '../elements'
import {ArrowNarrowRightIcon} from '../icons'
import {DraggableTerminal} from './draggable-terminal'

function HeroLeftAlignedWithDemo({
	eyebrow,
	headline,
	subheadline,
	cta,
	demo,
	footer,
	className,
	...props
}: {
	eyebrow?: ReactNode
	headline: ReactNode
	subheadline: ReactNode
	cta?: ReactNode
	demo?: ReactNode
	footer?: ReactNode
} & ComponentProps<'section'>) {
	return (
		<section className={className} {...props}>
			<Container className="flex flex-col gap-16">
				<div className="flex flex-col gap-16">
					<div className="flex flex-col items-start gap-6">
						{eyebrow}
						<Heading className="max-w-5xl">{headline}</Heading>
						<Text
							size="lg"
							className="flex max-w-3xl flex-col gap-4"
						>
							{subheadline}
						</Text>
						{cta}
					</div>
					{demo}
				</div>
				{footer}
			</Container>
		</section>
	)
}

function HeroImageFrame({
	className,
	children
}: {className?: string; children?: ReactNode}) {
	return (
		<div
			className={clsx(
				'relative overflow-hidden bg-cover bg-center',
				className
			)}
			style={{backgroundImage: "url('/hero-image-bg.png')"}}
		>
			<div className="relative [--padding:min(10%,--spacing(16))] max-h-[700px] overflow-hidden px-(--padding) pt-(--padding)">
				<div className="*:relative *:rounded-sm">{children}</div>
			</div>
		</div>
	)
}

export function HeroSection() {
	const testimonialLogos = [
		{
			src: '/logos/letraz.svg',
			alt: 'Letraz logo',
			width: 88,
			height: 13,
			className: 'h-5'
		},
		{
			src: '/logos/propsoch.svg',
			alt: 'Propsoch logo',
			width: 72,
			height: 20
		},
		{src: '/logos/rize.svg', alt: 'Rize logo', width: 96, height: 42},
		{src: '/logos/stacks.svg', alt: 'Stacks logo', width: 96, height: 24}
	]

	return (
		<HeroLeftAlignedWithDemo
			id="hero"
			className="py-16"
			eyebrow={
				<AnnouncementBadge
					href="/docs/agent-skills"
					text="New: Agent Skills for AI-powered development"
					cta="Learn more"
				/>
			}
			headline="Composable & extendable primitives to build rag systems."
			subheadline={
				<p>
					A simple system of ergonomically designed primitives that
					you can customize, extend, and build on to create versatile,
					robust and extendable RAG systems.
				</p>
			}
			cta={
				<div className="flex items-center gap-4">
					<ButtonLink href="/install" size="lg">
						Install Unrag
					</ButtonLink>

					<PlainButtonLink href="/docs" size="lg">
						Go to documentation <ArrowNarrowRightIcon />
					</PlainButtonLink>
				</div>
			}
			demo={
				<>
					<HeroImageFrame className="rounded-md lg:hidden">
						<div className="relative h-[560px] sm:h-[700px]">
							<DraggableTerminal
								className="rounded-sm overflow-hidden ring-1 ring-black/10"
								autoPlay
								initialTab="docs"
							/>
						</div>
					</HeroImageFrame>
					<HeroImageFrame className="rounded-lg max-lg:hidden">
						<div className="relative h-[560px] sm:h-[700px]">
							<DraggableTerminal
								className="rounded-sm overflow-hidden ring-1 ring-black/10"
								autoPlay
								initialTab="docs"
							/>
						</div>
					</HeroImageFrame>
				</>
			}
			footer={
				<LogoGrid>
					{testimonialLogos.map((logo) => (
						<Logo key={logo.src}>
							<img
								src={logo.src}
								alt={logo.alt}
								width={logo.width}
								height={logo.height}
								className={clsx(
									'h-7 w-auto brightness-0 saturate-0 dark:invert',
									logo.className
								)}
								loading="lazy"
							/>
						</Logo>
					))}
				</LogoGrid>
			}
		/>
	)
}
