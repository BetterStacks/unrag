import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { intro, outro } from '@clack/prompts'
import { addCommand } from './commands/add'
import { debugCommand } from './commands/debug'
import { doctorCommand } from './commands/doctor'
import { initCommand } from './commands/init'
import { upgradeCommand } from './commands/upgrade'
import { readCliPackageVersion } from './lib/cliVersion'
import { UNRAG_GITHUB_REPO_URL, docsUrl } from './lib/constants'
import { findUp } from './lib/fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function printVersion() {
	const cliPackageRoot = await findUp(__dirname, 'package.json')
	const version = cliPackageRoot
		? await readCliPackageVersion(cliPackageRoot)
		: 'unknown'
	process.stdout.write(`${version}\n`)
}

function renderHelp() {
	return [
		'unrag — vendor-in RAG primitives (ingest/retrieve + adapters) into your repo.',
		'',
		'Usage:',
		'  bunx unrag <command> [options]',
		'  npx  unrag <command> [options]',
		'',
		'Commands:',
		'  init                Install core files (config + store adapter templates)',
		'  add <connector>     Install a connector (notion, google-drive)',
		'  add extractor <n>   Install an extractor (pdf-llm, image-ocr, etc.)',
		'  add battery <name>  Install a battery module (reranker, eval, debug)',
		'  add skills          Install Unrag agent skills for your IDE/agent',
		'  upgrade             Upgrade vendored sources (git-style merge)',
		'  doctor              Validate installation and configuration',
		'  doctor setup        Generate project-specific doctor config and scripts',
		'  debug               Open real-time debug TUI (requires UNRAG_DEBUG=true in app)',
		'  help                Show this help',
		'',
		'Global options:',
		'  -h, --help           Show help',
		'  -y, --yes            Non-interactive; accept defaults',
		'',
		'init options:',
		'  --store <adapter>    drizzle | prisma | raw-sql',
		'  --dir <path>         Install directory (alias: --install-dir)',
		'  --alias <@name>      Import alias base (e.g. @unrag)',
		'  --preset <id|url>    Install from a web-generated preset (non-interactive)',
		'  --overwrite <mode>   skip | force (when files already exist)',
		'  --rich-media         Enable rich media setup (extractors + assetProcessing flags)',
		'  --no-rich-media      Disable rich media setup',
		'  --extractors <list>  Comma-separated extractors (implies --rich-media)',
		'  --no-install         Skip automatic dependency installation',
		'',
		'add options:',
		'  --no-install         Skip automatic dependency installation',
		'',
		'doctor options:',
		'  --config <path>      Load settings from a doctor config file',
		'  --db                 Run database checks (connectivity, schema, indexes)',
		'  --json               Output JSON for CI',
		'  --strict             Treat warnings as failures',
		'',
		'Examples:',
		'  bunx unrag@latest init',
		'  bunx unrag@latest init --yes --store drizzle --dir lib/unrag --alias @unrag',
		'  bunx unrag@latest init --yes --rich-media',
		'  bunx unrag@latest init --yes --extractors pdf-text-layer,file-text',
		'  bunx unrag add notion --yes',
		'  bunx unrag add battery reranker --yes',
		'  bunx unrag upgrade',
		'  bunx unrag doctor',
		'  bunx unrag doctor --db',
		'  bunx unrag doctor setup',
		'  bunx unrag doctor --config .unrag/doctor.json',
		'',
		'Docs:',
		`  - Quickstart: ${docsUrl('/docs/getting-started/quickstart')}`,
		`  - CLI:       ${docsUrl('/docs/reference/cli')}`,
		`  - Notion:    ${docsUrl('/docs/connectors/notion')}`,
		'',
		'Repo:',
		`  ${UNRAG_GITHUB_REPO_URL}`,
		'',
		'Tip:',
		'  Use `--with-docs` to generate unrag.md with schema + env vars.'
	].join('\n')
}

export async function run(argv: string[]) {
	const [, , command, ...rest] = argv

	if (command === '--version' || command === '-v' || command === 'version') {
		await printVersion()
		return
	}

	intro('unrag')

	if (
		!command ||
		command === 'help' ||
		command === '--help' ||
		command === '-h'
	) {
		outro(renderHelp())
		return
	}

	if (command === 'init') {
		await initCommand(rest)
		return
	}

	if (command === 'add') {
		await addCommand(rest)
		return
	}

	if (command === 'doctor') {
		await doctorCommand(rest)
		return
	}

	if (command === 'upgrade') {
		await upgradeCommand(rest)
		return
	}

	if (command === 'debug') {
		await debugCommand(rest)
		return
	}

	outro([`Unknown command: ${command}`, '', renderHelp()].join('\n'))
	process.exitCode = 1
}
