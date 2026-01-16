/**
 * Config coherence checks for doctor command.
 * Statically scans unrag.config.ts to detect extractor registration
 * and assetProcessing flag enablement.
 */

import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {docsUrl} from '../constants'
import {exists} from '../fs'
import type {CheckResult, InferredInstallState} from './types'
import {EXTRACTOR_CONFIG_FLAGS, EXTRACTOR_FACTORIES} from './types'

const CONFIG_TS_FILE = 'unrag.config.ts'

type ConfigScanResult = {
	configExists: boolean
	configContent: string | null
	registeredExtractors: string[]
	enabledFlags: string[]
	confidence: 'high' | 'medium' | 'low'
	parseWarnings: string[]
}

/**
 * Run config coherence checks.
 */
export async function runConfigCoherenceChecks(
	state: InferredInstallState
): Promise<CheckResult[]> {
	const results: CheckResult[] = []

	if (!state.configFileExists) {
		results.push({
			id: 'config-coherence',
			title: 'Config coherence',
			status: 'skip',
			summary: 'unrag.config.ts not found; skipping coherence checks.'
		})
		return results
	}

	const configPath = path.join(state.projectRoot, CONFIG_TS_FILE)
	const scanResult = await scanConfigFile(configPath)

	if (!scanResult.configContent) {
		results.push({
			id: 'config-coherence',
			title: 'Config coherence',
			status: 'warn',
			summary: 'Could not read unrag.config.ts for coherence analysis.'
		})
		return results
	}

	// Report scan confidence
	if (scanResult.parseWarnings.length > 0) {
		results.push({
			id: 'config-scan-quality',
			title: 'Config analysis',
			status: 'warn',
			summary: `Static analysis confidence: ${scanResult.confidence}`,
			details: scanResult.parseWarnings
		})
	}

	// Check each installed extractor
	for (const extractor of state.installedExtractors) {
		const extractorResult = checkExtractorCoherence(
			extractor,
			scanResult,
			state.installDir
		)
		results.push(extractorResult)
	}

	// Summary check if no extractors
	if (state.installedExtractors.length === 0) {
		results.push({
			id: 'config-extractors-summary',
			title: 'Extractor configuration',
			status: 'pass',
			summary: 'No extractors installed; nothing to check.'
		})
	}

	return results
}

/**
 * Scan config file for extractor registrations and flag settings.
 */
async function scanConfigFile(configPath: string): Promise<ConfigScanResult> {
	const result: ConfigScanResult = {
		configExists: false,
		configContent: null,
		registeredExtractors: [],
		enabledFlags: [],
		confidence: 'low',
		parseWarnings: []
	}

	if (!(await exists(configPath))) {
		return result
	}

	result.configExists = true

	try {
		result.configContent = await readFile(configPath, 'utf8')
	} catch {
		result.parseWarnings.push('Could not read config file.')
		return result
	}

	const content = result.configContent

	// Detect registered extractors by looking for factory calls
	result.registeredExtractors = detectRegisteredExtractors(content)

	// Detect enabled assetProcessing flags
	result.enabledFlags = detectEnabledFlags(content)

	// Determine confidence based on what we could detect
	if (content.includes('defineUnragConfig')) {
		result.confidence = 'high'
	} else if (
		content.includes('createUnragEngine') ||
		content.includes('createContextEngine')
	) {
		result.confidence = 'medium'
	} else {
		result.confidence = 'low'
		result.parseWarnings.push(
			"Config file doesn't appear to use standard Unrag patterns."
		)
	}

	// Warn about dynamic patterns that limit static analysis
	if (content.includes('...extractors') || content.includes('spread')) {
		result.parseWarnings.push(
			'Config uses spread operator for extractors; some may not be detected.'
		)
		result.confidence = 'medium'
	}

	// Only warn when an `enabled:` value itself is driven by env vars (not when env vars
	// are used elsewhere, e.g. DATABASE_URL for DB connectivity).
	const enabledUsesEnv =
		/enabled\s*:\s*[^,\n}]*process\.env\./i.test(content) ||
		/enabled\s*:\s*[^,\n}]*\bprocess\.env\[[^\]]+\]/i.test(content)
	if (enabledUsesEnv) {
		result.parseWarnings.push(
			'Config uses environment variables for assetProcessing enabled flags; runtime values may differ.'
		)
		result.confidence = 'medium'
	}

	return result
}

/**
 * Detect which extractors are registered in config by looking for factory calls.
 */
function detectRegisteredExtractors(content: string): string[] {
	const found: string[] = []

	for (const [extractorId, factoryName] of Object.entries(
		EXTRACTOR_FACTORIES
	)) {
		// Match factory call: createPdfLlmExtractor() or createPdfLlmExtractor({...})
		const pattern = new RegExp(`${factoryName}\\s*\\(`, 'i')
		if (pattern.test(content)) {
			found.push(extractorId)
		}

		// Also match import statements to catch cases where factory is imported but called elsewhere
		const importPattern = new RegExp(
			`import\\s*\\{[^}]*${factoryName}[^}]*\\}`,
			'i'
		)
		if (importPattern.test(content) && !found.includes(extractorId)) {
			// Only add if we also see the factory being used (not just imported)
			const usagePattern = new RegExp(`\\b${factoryName}\\b`, 'g')
			const matches = content.match(usagePattern)
			if (matches && matches.length > 1) {
				// More than just the import
				found.push(extractorId)
			}
		}
	}

	return found
}

/**
 * Detect which assetProcessing flags are enabled in config.
 */
function detectEnabledFlags(content: string): string[] {
	const enabled: string[] = []

	// Build patterns for each flag path
	const flagPatterns: Record<string, RegExp[]> = {
		'assetProcessing.pdf.llmExtraction.enabled': [
			/["']?pdf["']?\s*:\s*\{[^}]*["']?llmExtraction["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is,
			/["']?llmExtraction["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.pdf.textLayer.enabled': [
			/["']?pdf["']?\s*:\s*\{[^}]*["']?textLayer["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is,
			/["']?textLayer["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.pdf.ocr.enabled': [
			/["']?pdf["']?\s*:\s*\{[^}]*["']?ocr["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.image.ocr.enabled': [
			/["']?image["']?\s*:\s*\{[^}]*["']?ocr["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.image.captionLlm.enabled': [
			/["']?image["']?\s*:\s*\{[^}]*["']?captionLlm["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.audio.transcription.enabled': [
			/["']?audio["']?\s*:\s*\{[^}]*["']?transcription["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.video.transcription.enabled': [
			/["']?video["']?\s*:\s*\{[^}]*["']?transcription["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.video.frames.enabled': [
			/["']?video["']?\s*:\s*\{[^}]*["']?frames["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.file.text.enabled': [
			/["']?file["']?\s*:\s*\{[^}]*["']?text["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.file.docx.enabled': [
			/["']?file["']?\s*:\s*\{[^}]*["']?docx["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.file.pptx.enabled': [
			/["']?file["']?\s*:\s*\{[^}]*["']?pptx["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		],
		'assetProcessing.file.xlsx.enabled': [
			/["']?file["']?\s*:\s*\{[^}]*["']?xlsx["']?\s*:\s*\{[^}]*enabled\s*:\s*true/is
		]
	}

	for (const [flagPath, patterns] of Object.entries(flagPatterns)) {
		for (const pattern of patterns) {
			if (pattern.test(content)) {
				enabled.push(flagPath)
				break
			}
		}
	}

	return enabled
}

/**
 * Check coherence for a single extractor.
 */
function checkExtractorCoherence(
	extractorId: string,
	scanResult: ConfigScanResult,
	installDir: string | null
): CheckResult {
	const isRegistered = scanResult.registeredExtractors.includes(extractorId)
	const requiredFlags = EXTRACTOR_CONFIG_FLAGS[extractorId] ?? []
	const enabledRequiredFlags = requiredFlags.filter((f) =>
		scanResult.enabledFlags.includes(f)
	)
	const missingFlags = requiredFlags.filter(
		(f) => !scanResult.enabledFlags.includes(f)
	)

	const factoryName = EXTRACTOR_FACTORIES[extractorId]
	const importPath = installDir
		? `@unrag/extractors/${extractorId}`
		: `./lib/unrag/extractors/${extractorId}`

	// Case 1: Installed, registered, and flags enabled
	if (isRegistered && missingFlags.length === 0) {
		return {
			id: `coherence-${extractorId}`,
			title: `Extractor: ${extractorId}`,
			status: 'pass',
			summary: 'Installed, registered, and enabled.',
			meta: {
				registered: isRegistered,
				enabledFlags: enabledRequiredFlags
			}
		}
	}

	// Case 2: Installed but not registered
	if (!isRegistered) {
		return {
			id: `coherence-${extractorId}`,
			title: `Extractor: ${extractorId}`,
			status: 'warn',
			summary: 'Installed but not registered in config.',
			details: [
				`Factory ${factoryName}() not found in unrag.config.ts`,
				'Assets of this type will be skipped during ingestion.'
			],
			fixHints: [
				`Import and add to extractors array:`,
				`  import { ${factoryName} } from "${importPath}";`,
				`  engine: { extractors: [${factoryName}()] }`
			],
			docsLink: docsUrl(
				'/docs/reference/cli#registering-extractors-manually'
			),
			meta: {
				registered: false,
				confidence: scanResult.confidence
			}
		}
	}

	// Case 3: Registered but flags disabled
	if (missingFlags.length > 0) {
		return {
			id: `coherence-${extractorId}`,
			title: `Extractor: ${extractorId}`,
			status: 'warn',
			summary: 'Registered but required flags are disabled.',
			details: [
				`Missing enabled flags: ${missingFlags.join(', ')}`,
				"The extractor is wired but assets won't be processed."
			],
			fixHints: missingFlags.map(
				(f) =>
					`Set ${f.replace('assetProcessing.', 'engine.assetProcessing.')}: true`
			),
			meta: {
				registered: true,
				missingFlags,
				confidence: scanResult.confidence
			}
		}
	}

	// Fallback (shouldn't reach here)
	return {
		id: `coherence-${extractorId}`,
		title: `Extractor: ${extractorId}`,
		status: 'pass',
		summary: 'Configuration appears correct.'
	}
}
