'use client'

import {ArrowRight, Code, Copy, Database, ExternalLink, X} from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import {CodeBlock} from '@/components/code-block'
import {ButtonLink, PlainButton} from '@/components/elements'

import type {
	EmbeddingProviderName,
	RegistryManifest,
	WizardStateV1
} from './wizard-types'

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function adapterDocHref(
	storeAdapter: WizardStateV1['install']['storeAdapter']
) {
	if (storeAdapter === 'drizzle') {
		return '/docs/adapters/drizzle-postgres-pgvector'
	}
	if (storeAdapter === 'prisma') {
		return '/docs/adapters/prisma-postgres-pgvector'
	}
	return '/docs/adapters/raw-sql-postgres-pgvector'
}

function providerDocsHref(provider: EmbeddingProviderName) {
	const map: Record<string, string> = {
		ai: '/docs/providers/ai-gateway',
		openai: '/docs/providers/openai',
		google: '/docs/providers/google',
		openrouter: '/docs/providers/openrouter',
		azure: '/docs/providers/azure',
		vertex: '/docs/providers/vertex',
		bedrock: '/docs/providers/bedrock',
		cohere: '/docs/providers/cohere',
		mistral: '/docs/providers/mistral',
		together: '/docs/providers/together',
		ollama: '/docs/providers/ollama',
		voyage: '/docs/providers/voyage'
	}
	return map[provider] ?? '/docs/providers'
}

function providerLabel(provider: EmbeddingProviderName) {
	const map: Record<string, string> = {
		ai: 'Vercel AI Gateway',
		openai: 'OpenAI',
		google: 'Google AI (Gemini)',
		openrouter: 'OpenRouter',
		azure: 'Azure OpenAI',
		vertex: 'Vertex AI',
		bedrock: 'AWS Bedrock',
		cohere: 'Cohere',
		mistral: 'Mistral',
		together: 'Together.ai',
		ollama: 'Ollama',
		voyage: 'Voyage AI'
	}
	return map[provider] ?? 'Custom'
}

type EnvVar = {name: string; required: boolean; description: string}

function getEmbeddingEnvVars(provider: EmbeddingProviderName): EnvVar[] {
	const vars: Record<string, EnvVar[]> = {
		ai: [
			{
				name: 'AI_GATEWAY_API_KEY',
				required: true,
				description: 'API key for Vercel AI Gateway'
			}
		],
		openai: [
			{
				name: 'OPENAI_API_KEY',
				required: true,
				description: 'OpenAI API key'
			}
		],
		google: [
			{
				name: 'GOOGLE_GENERATIVE_AI_API_KEY',
				required: true,
				description: 'Google AI Studio API key'
			}
		],
		voyage: [
			{
				name: 'VOYAGE_API_KEY',
				required: true,
				description: 'Voyage AI API key'
			}
		],
		cohere: [
			{
				name: 'COHERE_API_KEY',
				required: true,
				description: 'Cohere API key'
			}
		],
		azure: [
			{
				name: 'AZURE_OPENAI_API_KEY',
				required: true,
				description: 'Azure OpenAI API key'
			},
			{
				name: 'AZURE_RESOURCE_NAME',
				required: true,
				description: 'Azure resource name'
			}
		],
		bedrock: [
			{
				name: 'AWS_REGION',
				required: true,
				description: 'AWS region for Bedrock'
			}
		]
	}
	return vars[provider] ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function StepNumber({children}: {children: React.ReactNode}) {
	return (
		<span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-olive-950 text-white text-sm font-medium dark:bg-olive-300 dark:text-olive-950">
			{children}
		</span>
	)
}

function EnvVarRow({name, required, description}: EnvVar) {
	return (
		<div className="flex items-start justify-between gap-4 py-3 border-b border-olive-950/10 last:border-0 dark:border-white/10">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<code className="font-mono text-sm text-olive-950 dark:text-white">
						{name}
					</code>
					{required && (
						<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-olive-950/10 text-olive-700 dark:bg-white/10 dark:text-olive-300">
							required
						</span>
					)}
				</div>
				<p className="mt-0.5 text-sm text-olive-600 dark:text-olive-400">
					{description}
				</p>
			</div>
		</div>
	)
}

function DocLink({href, children}: {href: string; children: React.ReactNode}) {
	return (
		<Link
			href={href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex items-center gap-1 text-sm text-olive-700 hover:text-olive-950 dark:text-olive-400 dark:hover:text-white transition-colors"
		>
			{children}
			<ExternalLink className="w-3 h-3" />
		</Link>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function NextStepsDialog({
	open,
	onOpenChange,
	state,
	manifest
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	state: WizardStateV1
	manifest: RegistryManifest | null
}) {
	const [copiedEnv, setCopiedEnv] = React.useState(false)
	const [copiedCode, setCopiedCode] = React.useState(false)

	const embeddingProvider = state.embedding.provider ?? 'ai'
	const embeddingVars = React.useMemo(
		() => getEmbeddingEnvVars(embeddingProvider),
		[embeddingProvider]
	)

	const connectorEnvVars: EnvVar[] = React.useMemo(() => {
		const selected = (state.modules.connectors ?? [])
			.map(String)
			.filter(Boolean)
		if (selected.length === 0) {
			return []
		}

		// Prefer manifest-driven env vars (keeps docs in sync with registry/manifest.json).
		const manifestVarsByConnector = new Map<string, EnvVar[]>()
		for (const c of manifest?.connectors ?? []) {
			const id = String(c.id ?? '').trim()
			if (!id) {
				continue
			}
			const env = Array.isArray(c.envVars) ? c.envVars : []
			const vars: EnvVar[] = env
				.map((v) => {
					const name = String(v?.name ?? '').trim()
					if (!name) {
						return null
					}
					return {
						name,
						required: Boolean(v?.required),
						description: String(v?.notes ?? '').trim()
					} satisfies EnvVar
				})
				.filter((x): x is EnvVar => Boolean(x))
			if (vars.length > 0) {
				manifestVarsByConnector.set(id, vars)
			}
		}

		// Fallback for older/trimmed manifests.
		const fallbackByConnector: Record<string, EnvVar[]> = {
			notion: [
				{
					name: 'NOTION_TOKEN',
					required: true,
					description: 'Server-only Notion integration token'
				}
			],
			'google-drive': [
				{
					name: 'GOOGLE_SERVICE_ACCOUNT_JSON',
					required: false,
					description:
						'Service account JSON credentials (server-only)'
				},
				{
					name: 'GOOGLE_CLIENT_ID',
					required: false,
					description: 'OAuth client id (server-only)'
				},
				{
					name: 'GOOGLE_CLIENT_SECRET',
					required: false,
					description: 'OAuth client secret (server-only)'
				},
				{
					name: 'GOOGLE_REDIRECT_URI',
					required: false,
					description: 'OAuth redirect URI'
				}
			],
			onedrive: [
				{
					name: 'AZURE_TENANT_ID',
					required: false,
					description: 'Azure AD tenant for OneDrive OAuth'
				},
				{
					name: 'AZURE_CLIENT_ID',
					required: false,
					description: 'Azure AD app client ID'
				},
				{
					name: 'AZURE_CLIENT_SECRET',
					required: false,
					description: 'Azure AD app client secret'
				}
			],
			dropbox: [
				{
					name: 'DROPBOX_CLIENT_ID',
					required: false,
					description: 'Dropbox app client ID'
				},
				{
					name: 'DROPBOX_CLIENT_SECRET',
					required: false,
					description: 'Dropbox app client secret'
				}
			]
		}

		const byName = new Map<string, EnvVar>()
		for (const id of selected) {
			const vars =
				manifestVarsByConnector.get(id) ?? fallbackByConnector[id] ?? []
			for (const v of vars) {
				const existing = byName.get(v.name)
				if (!existing) {
					byName.set(v.name, v)
					continue
				}
				byName.set(v.name, {
					name: v.name,
					required: existing.required || v.required,
					description: existing.description || v.description
				})
			}
		}

		return Array.from(byName.values()).sort((a, b) =>
			a.name.localeCompare(b.name)
		)
	}, [manifest, state.modules.connectors])

	const allEnvVars: EnvVar[] = React.useMemo(() => {
		const vars: EnvVar[] = [
			{
				name: 'DATABASE_URL',
				required: true,
				description: 'PostgreSQL + pgvector connection string'
			},
			...embeddingVars,
			...connectorEnvVars
		]
		if (state.modules.batteries?.includes('reranker')) {
			vars.push({
				name: 'COHERE_API_KEY',
				required: true,
				description: 'Required for reranker'
			})
		}
		// Deduplicate and keep required=true if any source marks it required.
		const byName = new Map<string, EnvVar>()
		for (const v of vars) {
			const name = String(v.name ?? '').trim()
			if (!name) {
				continue
			}
			const existing = byName.get(name)
			if (!existing) {
				byName.set(name, {...v, name})
				continue
			}
			byName.set(name, {
				name,
				required: existing.required || v.required,
				description: existing.description || v.description
			})
		}
		return Array.from(byName.values()).sort((a, b) =>
			a.name.localeCompare(b.name)
		)
	}, [connectorEnvVars, embeddingVars, state.modules.batteries])

	const codeSnippet = `import { createUnragEngine } from "@unrag/config";

const engine = createUnragEngine();

// Retrieve relevant chunks
const results = await engine.retrieve({
  query: "How do I get started?",
  topK: ${state.defaults.topK},
});`

	const copyEnvVars = async () => {
		try {
			await navigator.clipboard.writeText(
				allEnvVars.map((v) => `${v.name}=`).join('\n')
			)
			setCopiedEnv(true)
			setTimeout(() => setCopiedEnv(false), 2000)
		} catch {}
	}

	const copyCode = async () => {
		try {
			await navigator.clipboard.writeText(codeSnippet)
			setCopiedCode(true)
			setTimeout(() => setCopiedCode(false), 2000)
		} catch {}
	}

	if (!open) {
		return null
	}

	return (
		<div className="fixed inset-0 z-50">
			{/* Backdrop */}
			<button
				type="button"
				aria-label="Close dialog"
				className="absolute inset-0 bg-olive-950/60 dark:bg-black/70 backdrop-blur-sm"
				onClick={() => onOpenChange(false)}
			/>

			{/* Panel */}
			<div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-lemon-50 dark:bg-lemon-950 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
				{/* Header */}
				<header className="flex items-center justify-between px-6 py-4 shrink-0">
					<h2 className="font-display text-2xl text-olive-950 dark:text-white">
						Next steps
					</h2>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="p-2 rounded-full hover:bg-olive-950/10 dark:hover:bg-white/10 text-olive-700 dark:text-olive-300 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</header>

				{/* Content */}
				<div className="flex-1 overflow-y-auto">
					<div className="px-6 py-8 space-y-12">
						{/* Intro */}
						<p className="text-base text-olive-700 dark:text-olive-400 max-w-lg">
							Your configuration is ready. Complete these steps to
							start using Unrag in your project.
						</p>

						{/* Step 1: Environment Variables */}
						<section>
							<div className="flex items-center gap-3 mb-4">
								<StepNumber>1</StepNumber>
								<h3 className="font-display text-xl text-olive-950 dark:text-white">
									Set environment variables
								</h3>
							</div>

							<p className="text-sm text-olive-600 dark:text-olive-400 mb-4">
								Add these to your{' '}
								<code className="font-mono text-olive-950 dark:text-white">
									.env.local
								</code>{' '}
								file or your deployment environment.
							</p>

							<div className="rounded-lg border border-olive-950/10 dark:border-white/10 bg-white/50 dark:bg-white/5 overflow-hidden">
								<div className="flex items-center justify-between px-4 py-2 border-b border-olive-950/10 dark:border-white/10 bg-olive-950/5 dark:bg-white/5">
									<span className="text-xs font-medium text-olive-600 dark:text-olive-400 uppercase tracking-wider">
										Environment variables
									</span>
									<PlainButton
										size="md"
										onClick={copyEnvVars}
									>
										<Copy className="w-3.5 h-3.5" />
										{copiedEnv ? 'Copied!' : 'Copy all'}
									</PlainButton>
								</div>
								<div className="px-4">
									{allEnvVars.map((v) => (
										<EnvVarRow key={v.name} {...v} />
									))}
								</div>
							</div>

							<div className="mt-3 flex flex-wrap items-center gap-4">
								<DocLink
									href={providerDocsHref(embeddingProvider)}
								>
									{providerLabel(embeddingProvider)} setup
								</DocLink>
								<DocLink
									href={adapterDocHref(
										state.install.storeAdapter
									)}
								>
									Database adapter docs
								</DocLink>
							</div>
						</section>

						{/* Step 2: Run migrations */}
						<section>
							<div className="flex items-center gap-3 mb-4">
								<StepNumber>2</StepNumber>
								<h3 className="font-display text-xl text-olive-950 dark:text-white">
									Run database migrations
								</h3>
							</div>

							<p className="text-sm text-olive-600 dark:text-olive-400 mb-4">
								Unrag needs tables to store documents, chunks,
								and embeddings. Run the migration for your
								adapter.
							</p>

							<div className="rounded-lg border border-olive-950/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4">
								<code className="font-mono text-sm text-olive-950 dark:text-white">
									{state.install.storeAdapter === 'drizzle' &&
										'npx drizzle-kit push'}
									{state.install.storeAdapter === 'prisma' &&
										'npx prisma db push'}
									{state.install.storeAdapter === 'raw-sql' &&
										'psql $DATABASE_URL -f lib/unrag/schema.sql'}
								</code>
							</div>

							<div className="mt-3">
								<DocLink href="/docs/getting-started/database">
									Database setup guide
								</DocLink>
							</div>
						</section>

						{/* Step 3: Use the API */}
						<section>
							<div className="flex items-center gap-3 mb-4">
								<StepNumber>3</StepNumber>
								<h3 className="font-display text-xl text-olive-950 dark:text-white">
									Start retrieving
								</h3>
							</div>

							<p className="text-sm text-olive-600 dark:text-olive-400 mb-4">
								Import the engine and call{' '}
								<code className="font-mono text-olive-950 dark:text-white">
									retrieve()
								</code>{' '}
								with your query.
							</p>

							<div className="rounded-lg border border-olive-950/10 dark:border-white/10 bg-white/50 dark:bg-white/5 overflow-hidden">
								<div className="flex items-center justify-between px-4 py-2 border-b border-olive-950/10 dark:border-white/10 bg-olive-950/5 dark:bg-white/5">
									<span className="text-xs font-medium text-olive-600 dark:text-olive-400 uppercase tracking-wider">
										TypeScript
									</span>
									<PlainButton size="md" onClick={copyCode}>
										<Copy className="w-3.5 h-3.5" />
										{copiedCode ? 'Copied!' : 'Copy'}
									</PlainButton>
								</div>
								<div className="p-4">
									<CodeBlock
										code={codeSnippet}
										highlight={[0, 1, 4, 5, 6, 7]}
									/>
								</div>
							</div>

							<div className="mt-3">
								<DocLink href="/docs/getting-started/first-retrieval">
									Full retrieval guide
								</DocLink>
							</div>
						</section>

						{/* Resources */}
						<section className="pt-6 border-t border-olive-950/10 dark:border-white/10">
							<h3 className="font-display text-lg text-olive-950 dark:text-white mb-4">
								Resources
							</h3>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<Link
									href="/docs"
									target="_blank"
									className="flex items-center gap-3 p-4 rounded-lg border border-olive-950/10 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-olive-950/5 dark:hover:bg-white/10 transition-colors group"
								>
									<div className="w-10 h-10 rounded-lg bg-olive-950/10 dark:bg-white/10 flex items-center justify-center text-olive-700 dark:text-olive-300">
										<Code className="w-5 h-5" />
									</div>
									<div>
										<div className="text-sm font-medium text-olive-950 dark:text-white group-hover:underline">
											Documentation
										</div>
										<div className="text-xs text-olive-600 dark:text-olive-400">
											Guides, API reference, examples
										</div>
									</div>
								</Link>
								<Link
									href="/docs/concepts/architecture"
									target="_blank"
									className="flex items-center gap-3 p-4 rounded-lg border border-olive-950/10 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-olive-950/5 dark:hover:bg-white/10 transition-colors group"
								>
									<div className="w-10 h-10 rounded-lg bg-olive-950/10 dark:bg-white/10 flex items-center justify-center text-olive-700 dark:text-olive-300">
										<Database className="w-5 h-5" />
									</div>
									<div>
										<div className="text-sm font-medium text-olive-950 dark:text-white group-hover:underline">
											Architecture
										</div>
										<div className="text-xs text-olive-600 dark:text-olive-400">
											How Unrag works under the hood
										</div>
									</div>
								</Link>
							</div>
						</section>
					</div>
				</div>

				{/* Footer */}
				<footer className="px-6 py-4 border-t border-olive-950/10 dark:border-white/10 bg-olive-950/5 dark:bg-white/5 shrink-0">
					<div className="flex items-center justify-between">
						<PlainButton
							size="lg"
							onClick={() => onOpenChange(false)}
						>
							Close
						</PlainButton>
						<ButtonLink
							href="/docs/getting-started/quickstart"
							size="lg"
							target="_blank"
						>
							Read the quickstart
							<ArrowRight className="w-4 h-4" />
						</ButtonLink>
					</div>
				</footer>
			</div>
		</div>
	)
}
