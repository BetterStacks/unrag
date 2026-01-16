import {baseOptions} from '@/lib/layout.shared'
import {source} from '@/lib/source'
import {DocsLayout} from 'fumadocs-ui/layouts/docs'

export default function Layout({children}: LayoutProps<'/docs'>) {
	const base = baseOptions()

	return (
		<DocsLayout tree={source.pageTree} {...base} links={[]}>
			{children}
		</DocsLayout>
	)
}
