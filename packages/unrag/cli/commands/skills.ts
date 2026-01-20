import { mkdir, readdir, copyFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cancel, isCancel, log, multiselect, outro } from '@clack/prompts'
import { exists, findUp } from '../lib/fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ANSI color codes
const GRAY = '\x1b[37m'
const DARK = '\x1b[90m'
const RESET = '\x1b[0m'
const B = GRAY
const D = DARK
const R = RESET

const BANNER = `
${B}          ██${D}╗   ${B}██${D}╗${B}███${D}╗   ${B}██${D}╗${B}██████${D}╗  ${B}█████${D}╗  ${B}██████${D}╗${R}
${B}          ██${D}║   ${B}██${D}║${B}████${D}╗  ${B}██${D}║${B}██${D}╔══${B}██${D}╗${B}██${D}╔══${B}██${D}╗${B}██${D}╔════╝${R}
${B}          ██${D}║   ${B}██${D}║${B}██${D}╔${B}██${D}╗ ${B}██${D}║${B}██████${D}╔╝${B}███████${D}║${B}██${D}║  ${B}███${D}╗${R}
${B}          ██${D}║   ${B}██${D}║${B}██${D}║╚${B}██${D}╗${B}██${D}║${B}██${D}╔══${B}██${D}╗${B}██${D}╔══${B}██${D}║${B}██${D}║   ${B}██${D}║${R}
${D}          ╚${B}██████${D}╔╝${B}██${D}║ ╚${B}████${D}║${B}██${D}║  ${B}██${D}║${B}██${D}║  ${B}██${D}║╚${B}██████${D}╔╝${R}
${D}           ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝${R}
${D}                           skills${R}
`

type AgentId = 'claude-code' | 'cursor' | 'windsurf' | 'antigravity' | 'codex'

interface AgentConfig {
    id: AgentId
    name: string
    description: string
    getInstallPath: (projectRoot: string) => string
    isGlobal: boolean
}

const AGENTS: AgentConfig[] = [
    {
        id: 'claude-code',
        name: 'Claude Code',
        description: 'Anthropic Claude Code (.claude/skills/)',
        getInstallPath: (projectRoot) =>
            path.join(projectRoot, '.claude', 'skills', 'unrag'),
        isGlobal: false
    },
    {
        id: 'cursor',
        name: 'Cursor',
        description: 'Cursor IDE (.cursor/rules/)',
        getInstallPath: (projectRoot) =>
            path.join(projectRoot, '.cursor', 'rules', 'unrag'),
        isGlobal: false
    },
    {
        id: 'windsurf',
        name: 'Windsurf',
        description: 'Windsurf AI (.windsurf/rules/)',
        getInstallPath: (projectRoot) =>
            path.join(projectRoot, '.windsurf', 'rules', 'unrag'),
        isGlobal: false
    },
    {
        id: 'antigravity',
        name: 'Antigravity',
        description: 'Google Antigravity (.gemini/skills/)',
        getInstallPath: (projectRoot) =>
            path.join(projectRoot, '.gemini', 'skills', 'unrag'),
        isGlobal: false
    },
    {
        id: 'codex',
        name: 'Codex',
        description: 'OpenAI Codex CLI (~/.codex/prompts/)',
        getInstallPath: () => path.join(homedir(), '.codex', 'prompts', 'unrag'),
        isGlobal: true
    }
]

async function copyDirectory(src: string, dest: string): Promise<string[]> {
    const copiedFiles: string[] = []

    await mkdir(dest, { recursive: true })

    const entries = await readdir(src, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
            const nested = await copyDirectory(srcPath, destPath)
            copiedFiles.push(...nested)
        } else {
            await copyFile(srcPath, destPath)
            copiedFiles.push(destPath)
        }
    }

    return copiedFiles
}

export async function skillsCommand(args: string[]) {
    const nonInteractive = args.includes('--yes') || args.includes('-y')

    // Print the banner
    console.log(BANNER)

    // Find CLI package root to locate bundled skills
    const cliPackageRoot = await findUp(__dirname, 'package.json')
    if (!cliPackageRoot) {
        outro('Could not locate CLI package root.')
        process.exitCode = 1
        return
    }

    // Skills are bundled in the registry
    const skillsSource = path.join(cliPackageRoot, 'registry', 'skills', 'unrag')
    if (!(await exists(skillsSource))) {
        outro('Skills bundle not found in CLI package.')
        process.exitCode = 1
        return
    }

    // Find project root for project-local installations
    const projectRoot = process.cwd()

    let selectedAgents: AgentConfig[] = []

    if (nonInteractive) {
        // Default to Claude Code in non-interactive mode
        const claudeCode = AGENTS.find((a) => a.id === 'claude-code')
        if (claudeCode) selectedAgents = [claudeCode]
    } else {
        const choices = await multiselect({
            message:
                'Which IDE/agents would you like to install the Unrag skill for?',
            options: AGENTS.map((agent) => ({
                value: agent.id,
                label: agent.name,
                hint: agent.description
            })),
            required: true
        })

        if (isCancel(choices)) {
            cancel('Cancelled.')
            return
        }

        selectedAgents = (choices as AgentId[])
            .map((id) => AGENTS.find((a) => a.id === id))
            .filter((a): a is AgentConfig => a !== undefined)
    }

    if (selectedAgents.length === 0) {
        outro('No agents selected.')
        return
    }

    const installed: string[] = []
    const skipped: string[] = []

    for (const agent of selectedAgents) {
        const installPath = agent.getInstallPath(projectRoot)

        // Check if already installed
        if (await exists(installPath)) {
            skipped.push(agent.name)
            continue
        }

        // Copy the skills
        log.step(`Installing Unrag skills for ${agent.name}...`)

        try {
            await copyDirectory(skillsSource, installPath)
            installed.push(agent.name)

            if (agent.isGlobal) {
                log.success(`Installed to ${installPath}`)
            } else {
                log.success(`Installed to ${path.relative(projectRoot, installPath)}/`)
            }
        } catch (err) {
            log.error(
                `Failed to install for ${agent.name}: ${err instanceof Error ? err.message : String(err)}`
            )
        }
    }

    // Summary
    const summary: string[] = []

    if (installed.length > 0) {
        summary.push(`✓ Installed for: ${installed.join(', ')}`)
    }
    if (skipped.length > 0) {
        summary.push(`⊘ Already installed: ${skipped.join(', ')}`)
    }

    if (summary.length > 0) {
        outro(
            summary.join('\n') +
            '\n\nYour AI assistants now have access to Unrag documentation and patterns.'
        )
    }
}
