'use client'

import {type ComponentProps, type ReactNode, useId, useState} from 'react'
import {Container, Subheading, Text} from '../elements'
import {MinusIcon, PlusIcon} from '../icons'

function Faq({
	id,
	question,
	answer,
	...props
}: {question: ReactNode; answer: ReactNode} & ComponentProps<'div'>) {
	const autoId = useId()
	const [open, setOpen] = useState(false)
	const resolvedId = id || autoId

	return (
		<div id={resolvedId} {...props}>
			<button
				type="button"
				id={`${resolvedId}-question`}
				aria-expanded={open}
				aria-controls={`${resolvedId}-answer`}
				onClick={() => setOpen((value) => !value)}
				className="flex w-full items-start justify-between gap-6 py-4 text-left text-base/7 text-olive-950 dark:text-white"
			>
				{question}
				<PlusIcon className="h-lh in-aria-expanded:hidden" />
				<MinusIcon className="h-lh not-in-aria-expanded:hidden" />
			</button>
			<div
				id={`${resolvedId}-answer`}
				hidden={!open}
				className="-mt-2 flex flex-col gap-2 pr-12 pb-4 text-sm/7 text-olive-700 dark:text-olive-400"
			>
				{answer}
			</div>
		</div>
	)
}

function FAQsTwoColumnAccordion({
	headline,
	subheadline,
	className,
	children,
	...props
}: {
	headline?: ReactNode
	subheadline?: ReactNode
} & ComponentProps<'section'>) {
	return (
		<section className={`py-16 ${className ?? ''}`} {...props}>
			<Container className="grid grid-cols-1 gap-x-2 gap-y-8 lg:grid-cols-2">
				<div className="flex flex-col gap-6">
					<Subheading>{headline}</Subheading>
					{subheadline && (
						<Text className="flex flex-col gap-4 text-pretty">
							{subheadline}
						</Text>
					)}
				</div>
				<div className="divide-y divide-olive-950/10 border-y border-olive-950/10 dark:divide-white/10 dark:border-white/10">
					{children}
				</div>
			</Container>
		</section>
	)
}

export function FAQsSection() {
	return (
		<FAQsTwoColumnAccordion id="faqs" headline="Questions & Answers">
			<Faq
				id="faq-1"
				question="What does Unrag install into my repo?"
				answer="A small set of TypeScript source files, plus a single unrag.config.ts file. You can read, review, and edit everything."
			/>
			<Faq
				id="faq-2"
				question="Which databases and ORMs are supported?"
				answer="Unrag targets Postgres + pgvector and ships adapters for Drizzle, Prisma, and raw SQL."
			/>
			<Faq
				id="faq-3"
				question="Can I customize chunking and embeddings?"
				answer="Yes. The chunker, embeddings provider, and store adapter are all pluggable and configured in unrag.config.ts."
			/>
			<Faq
				id="faq-4"
				question="Is Unrag a hosted service?"
				answer="No. It is a small, vendored module that lives in your codebase. Your data stays in your database."
			/>
		</FAQsTwoColumnAccordion>
	)
}
