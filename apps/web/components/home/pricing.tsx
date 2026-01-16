import type {ComponentProps, ReactNode} from 'react'
import {ButtonLink, Section, SoftButtonLink} from '../elements'
import {CheckmarkIcon} from '../icons'

function Plan({
	name,
	price,
	period,
	subheadline,
	badge,
	features,
	cta,
	className
}: {
	name: ReactNode
	price: ReactNode
	period?: ReactNode
	subheadline: ReactNode
	badge?: ReactNode
	features: string[]
	cta: ReactNode
} & ComponentProps<'div'>) {
	return (
		<div
			className={`flex flex-col justify-between gap-6 rounded-xl bg-olive-950/2.5 p-6 sm:items-start dark:bg-white/5 ${className ?? ''}`}
		>
			<div className="self-stretch">
				<div className="flex items-center justify-between">
					{badge && (
						<div className="order-last inline-flex rounded-full bg-olive-950/10 px-2 text-xs/6 font-medium text-olive-950 dark:bg-white/10 dark:text-white">
							{badge}
						</div>
					)}

					<h3 className="text-2xl/8 tracking-tight text-olive-950 dark:text-white">
						{name}
					</h3>
				</div>
				<p className="mt-1 inline-flex gap-1 text-base/7">
					<span className="text-olive-950 dark:text-white">
						{price}
					</span>
					{period && (
						<span className="text-olive-500 dark:text-olive-500">
							{period}
						</span>
					)}
				</p>
				<div className="mt-4 flex flex-col gap-4 text-sm/6 text-olive-700 dark:text-olive-400">
					{subheadline}
				</div>
				<ul className="mt-4 space-y-2 text-sm/6 text-olive-700 dark:text-olive-400">
					{features.map((feature) => (
						<li key={feature} className="flex gap-4">
							<CheckmarkIcon className="h-lh shrink-0 stroke-olive-950 dark:stroke-white" />
							<p>{feature}</p>
						</li>
					))}
				</ul>
			</div>
			{cta}
		</div>
	)
}

function PricingMultiTier({
	plans,
	...props
}: {
	plans: ReactNode
} & ComponentProps<typeof Section>) {
	return (
		<Section {...props}>
			<div className="grid grid-cols-1 gap-2 sm:has-[>:nth-child(5)]:grid-cols-2 sm:max-lg:has-[>:last-child:nth-child(even)]:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:has-[>:nth-child(5)]:grid-flow-row lg:has-[>:nth-child(5)]:grid-cols-3">
				{plans}
			</div>
		</Section>
	)
}

export function PricingSection() {
	return (
		<PricingMultiTier
			id="pricing"
			headline="Pricing to fit your business needs."
			plans={
				<>
					<Plan
						name="Starter"
						price="$12"
						period="/mo"
						subheadline={
							<p>
								Small teams getting started with shared inboxes
							</p>
						}
						features={[
							'Shared inbox for up to 2 mailboxes',
							'Tagging & assignment',
							'Private notes',
							'Automatic replies',
							'Email support'
						]}
						cta={
							<SoftButtonLink href="#" size="lg">
								Start free trial
							</SoftButtonLink>
						}
					/>
					<Plan
						name="Growth"
						price="$49"
						period="/mo"
						subheadline={
							<p>
								Growing teams needing collaboration and insights
							</p>
						}
						badge="Most popular"
						features={[
							'Everything in Starter',
							'Inbox Agent',
							'Unlimited mailboxes',
							'Collision detection',
							'Snippets and templates',
							'Reporting dashboard',
							'Slack integration'
						]}
						cta={
							<ButtonLink href="#" size="lg">
								Start free trial
							</ButtonLink>
						}
					/>
					<Plan
						name="Pro"
						price="$299"
						period="/mo"
						subheadline={
							<p>
								Support-focused organizations and larger teams
							</p>
						}
						features={[
							'Everything in Growth',
							'Custom roles & permissions',
							'Automation engine',
							'API access',
							'SLA tracking',
							'SSO support',
							'SOC 2 compliance'
						]}
						cta={
							<SoftButtonLink href="#" size="lg">
								Start free trial
							</SoftButtonLink>
						}
					/>
				</>
			}
		/>
	)
}
