import {existsSync, readFileSync, statSync} from 'node:fs'
import path from 'node:path'

export type UnragInstallInfo = {
	installDir?: string
	batteries?: string[]
	connectors?: string[]
	extractors?: string[]
}

export function readUnragJson(
	cwd: string = process.cwd()
): UnragInstallInfo | null {
	try {
		const p = path.join(cwd, 'unrag.json')
		if (!existsSync(p)) {
			return null
		}
		const raw = readFileSync(p, 'utf8')
		const json = JSON.parse(raw) as unknown
		if (!json || typeof json !== 'object') {
			return null
		}
		return json as UnragInstallInfo
	} catch {
		return null
	}
}

export function isUnragBatteryInstalled(
	name: string,
	cwd: string = process.cwd()
): boolean {
	const info = readUnragJson(cwd)
	const batteries = Array.isArray(info?.batteries) ? info?.batteries! : []
	return batteries.includes(name)
}

export function hasVendoredModuleDir(
	dirName: string,
	cwd: string = process.cwd()
): boolean {
	const info = readUnragJson(cwd)
	const installDir =
		typeof info?.installDir === 'string' ? info.installDir : 'lib/unrag'
	const abs = path.join(cwd, installDir, dirName)
	try {
		return existsSync(abs) && statSync(abs).isDirectory()
	} catch {
		return false
	}
}
