import type {EmbeddingProvider, UnragEmbeddingConfig} from '@unrag/core/types'
import {createAiEmbeddingProvider} from '@unrag/embedding/ai'

export function createEmbeddingProviderFromConfig(
	config: UnragEmbeddingConfig
): EmbeddingProvider {
	if (config.provider === 'custom') {
		return config.create()
	}

	switch (config.provider) {
		case 'ai':
			return createAiEmbeddingProvider(config.config)
		default:
			throw new Error(
				`Embedding provider "${String(
					(config as {provider?: string}).provider
				)}" is not installed. Re-run init with --full or select a supported provider.`
			)
	}
}
