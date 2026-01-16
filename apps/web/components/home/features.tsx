import {clsx} from 'clsx/lite'
import type {ComponentProps, ReactNode} from 'react'
import {TextLink, Section} from '../elements'
import {ArrowNarrowRightIcon} from '../icons'

function Feature({
	demo,
	headline,
	subheadline,
	cta,
	className
}: {
	demo: ReactNode
	headline: ReactNode
	subheadline: ReactNode
	cta: ReactNode
} & Omit<ComponentProps<'div'>, 'children'>) {
	return (
		<div
			className={`rounded-lg bg-olive-950/2.5 p-2 dark:bg-white/5 ${className ?? ''}`}
		>
			<div className="relative overflow-hidden rounded-sm dark:after:absolute dark:after:inset-0 dark:after:rounded-sm dark:after:outline-1 dark:after:-outline-offset-1 dark:after:outline-white/10">
				{demo}
			</div>
			<div className="flex flex-col gap-4 p-6 sm:p-10 lg:p-6">
				<div>
					<h3 className="text-base/8 font-medium text-olive-950 dark:text-white">
						{headline}
					</h3>
					<div className="mt-2 flex flex-col gap-4 text-sm/7 text-olive-700 dark:text-olive-400">
						{subheadline}
					</div>
				</div>
				{cta}
			</div>
		</div>
	)
}

function FeaturesTwoColumnWithDemos({
	features,
	...props
}: {features: ReactNode} & Omit<ComponentProps<typeof Section>, 'children'>) {
	return (
		<Section {...props}>
			<div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
				{features}
			</div>
		</Section>
	)
}

function FeatureImageFrame({
	backgroundImage,
	imageSrc,
	imageAlt,
	placement = 'top-right',
	className
}: {
	backgroundImage: string
	imageSrc: string
	imageAlt: string
	placement?: 'top-right' | 'top-left'
	className?: string
}) {
	return (
		<div
			className={clsx(
				'relative h-[320px] sm:h-[380px] overflow-hidden bg-cover bg-center',
				className
			)}
			style={{backgroundImage: `url('${backgroundImage}')`}}
		>
			<div
				className={clsx(
					'absolute w-[90%] sm:w-[85%] top-12 sm:top-16',
					placement === 'top-right' && '-right-6 sm:-right-8',
					placement === 'top-left' && '-left-6 sm:-left-8'
				)}
			>
				<img
					src={imageSrc}
					alt={imageAlt}
					className={clsx(
						'block w-full ring-1 ring-black/10',
						placement === 'top-right' &&
							'rounded-tl-md rounded-bl-md',
						placement === 'top-left' &&
							'rounded-tr-md rounded-br-md'
					)}
				/>
			</div>
		</div>
	)
}

export function FeaturesSection() {
	return (
		<FeaturesTwoColumnWithDemos
			id="features"
			eyebrow="Built for ownership"
			headline="RAG primitives you can read, ship, and extend."
			subheadline={
				<p>
					Install a small, auditable module into your codebase and
					keep the core of the RAG pipeline, consisting extraction,
					ingestion, retrieval and reranking fully under your control.
				</p>
			}
			features={
				<>
					<Feature
						demo={
							<FeatureImageFrame
								backgroundImage="/feature-1-bg.jpg"
								imageSrc="/hero-image.png"
								imageAlt="Unrag module preview"
								placement="top-right"
								className="rounded-md"
							/>
						}
						headline="Observe and monitor the entire pipeline"
						subheadline={
							<p>
								With the powerful and comprehensive debug tool
								Unrag ships with, you can test and monitor your
								ingestion and retrieval pipeline without
								building any application logic around it.
							</p>
						}
						cta={
							<TextLink href="/docs/debugging">
								See in action <ArrowNarrowRightIcon />
							</TextLink>
						}
					/>
					<Feature
						demo={
							<FeatureImageFrame
								backgroundImage="/feature-2-bg.jpg"
								imageSrc="/feature-2.png"
								imageAlt="Unrag pipeline view"
								placement="top-left"
								className="rounded-md"
							/>
						}
						headline="Vendored source, not a black box"
						subheadline={
							<p>
								Unrag installs TypeScript source files you own.
								Review them in PRs, debug locally, and change
								the behavior when your product needs it.
							</p>
						}
						cta={
							<TextLink href="/docs/getting-started/installation">
								See the install flow <ArrowNarrowRightIcon />
							</TextLink>
						}
					/>
				</>
			}
		/>
	)
}
