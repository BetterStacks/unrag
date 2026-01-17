import {Accordion, Accordions} from 'fumadocs-ui/components/accordion'
import {Banner} from 'fumadocs-ui/components/banner'
import {File, Files, Folder} from 'fumadocs-ui/components/files'
import {ImageZoom} from 'fumadocs-ui/components/image-zoom'
import {Step, Steps} from 'fumadocs-ui/components/steps'
import {Tab, Tabs} from 'fumadocs-ui/components/tabs'
import {TypeTable} from 'fumadocs-ui/components/type-table'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type {MDXComponents} from 'mdx/types'
import type {ComponentProps} from 'react'
import {Mermaid} from './components/mdx/mermaid'
import {PackageInstall} from './components/mdx/package-install'

export function getMDXComponents(components?: MDXComponents): MDXComponents {
	return {
		...defaultMdxComponents,
		Step,
		Steps,
		Tab,
		Tabs,
		Accordion,
		Accordions,
		File,
		Folder,
		Files,
		TypeTable,
		Banner,
		Mermaid,
		PackageInstall,
		img: (props) => (
			<ImageZoom
				{...(props as unknown as ComponentProps<typeof ImageZoom>)}
			/>
		),
		...components
	}
}
