import type {
	EmbeddingProvider,
	UnragEmbeddingConfig
} from '@registry/core/types'
// __UNRAG_PROVIDER_IMPORTS__

export function createEmbeddingProviderFromConfig(
	config: UnragEmbeddingConfig
): EmbeddingProvider {
	if (config.provider === 'custom') {
		return config.create()
	}

	switch (config.provider) {
		// __UNRAG_PROVIDER_CASES__
		default:
			throw new Error(
				`Embedding provider "${String(
					(config as {provider?: string}).provider
				)}" is not installed. Re-run init with --full or select a supported provider.`
			)
	}
}
