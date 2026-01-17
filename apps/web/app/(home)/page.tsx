import {Main} from '@/components/elements'
import {CallToActionSection} from '@/components/home/call-to-action'
import {FAQsSection} from '@/components/home/faqs'
import {FeaturesSection} from '@/components/home/features'
import {FooterSection} from '@/components/home/footer'
import {HeroSection} from '@/components/home/hero'
import {RegistrySection} from '@/components/home/registry-section'
import {StatsSection} from '@/components/home/stats'
import {TestimonialsSection} from '@/components/home/testimonials'
import type {Metadata} from 'next'

export const metadata: Metadata = {
	title: 'Unrag - RAG primitives you own and understand',
	description:
		'When you can read the code, you can trust it. Unrag installs small TypeScript primitives for vector storage and retrieval directly into your codebase, no framework to outgrow, no service to depend on, just source files that ship with your app.',
	openGraph: {
		title: 'Unrag - RAG primitives you own and understand',
		description:
			'When you can read the code, you can trust it. Unrag installs small TypeScript primitives for vector storage and retrieval directly into your codebase—no framework to outgrow, no service to depend on, just source files that ship with your app.',
		url: '/',
		siteName: 'Unrag',
		type: 'website',
		images: [
			{
				url: '/opengraph-image.png',
				width: 1200,
				height: 630,
				alt: 'Unrag'
			}
		]
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Unrag - RAG primitives you own and understand',
		description:
			'When you can read the code, you can trust it. Unrag installs small TypeScript primitives for vector storage and retrieval directly into your codebase—no framework to outgrow, no service to depend on, just source files that ship with your app.',
		images: ['/twitter-image.png']
	},
	keywords: [
		'RAG',
		'vector search',
		'embeddings',
		'TypeScript',
		'code ownership',
		'pgvector',
		'open source'
	]
}

export default function Page() {
	return (
		<>
			<Main>
				<HeroSection />
				<FeaturesSection />
				<RegistrySection />
				<StatsSection />
				<FAQsSection />
				<TestimonialsSection />
				<CallToActionSection />
			</Main>
			<FooterSection />
		</>
	)
}
