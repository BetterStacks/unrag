import {getPageImage, source} from '@/lib/source'
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle
} from 'fumadocs-ui/layouts/docs/page'
import {notFound} from 'next/navigation'
import {getMDXComponents} from '@/mdx-components'
import type {Metadata} from 'next'
import {createRelativeLink} from 'fumadocs-ui/mdx'
import SystemBanner from '@/components/ui/system-banner'
import RAGHandbookBanner from '@/components/rag-handbook-banner'

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
	const params = await props.params
	const page = source.getPage(params.slug)
	if (!page) notFound()

	const MDX = page.data.body
	const slug = params.slug ?? []
	const isExperimentalFeature =
		slug[0] === 'debugging' ||
		(slug[0] === 'batteries' && slug[1] === 'debug')

	const showRagHandbookBanner = slug[0] !== 'changelog' && slug[0] !== 'rag'

	return (
		<DocsPage
			toc={page.data.toc}
			full={page.data.full}
			tableOfContent={{
				footer: showRagHandbookBanner ? <RAGHandbookBanner /> : null
			}}
		>
			<SystemBanner
				text="Experimental Feature"
				color="bg-amber-600"
				size="xs"
				show={isExperimentalFeature}
			/>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDX
					components={getMDXComponents({
						// this allows you to link to other pages with relative file paths
						a: createRelativeLink(source, page)
					})}
				/>
			</DocsBody>
		</DocsPage>
	)
}

export async function generateStaticParams() {
	return source.generateParams()
}

export async function generateMetadata(
	props: PageProps<'/docs/[[...slug]]'>
): Promise<Metadata> {
	const params = await props.params
	const page = source.getPage(params.slug)
	if (!page) notFound()

	return {
		title: page.data.title,
		description: page.data.description,
		openGraph: {
			images: getPageImage(page).url
		}
	}
}
