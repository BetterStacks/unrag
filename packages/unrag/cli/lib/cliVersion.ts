import path from 'node:path'
import {readJsonFile} from './json'

type PackageJson = {
	version?: string
}

export async function readCliPackageVersion(
	cliPackageRoot: string
): Promise<string> {
	const pkg = await readJsonFile<PackageJson>(
		path.join(cliPackageRoot, 'package.json')
	)
	const version = pkg?.version
	return typeof version === 'string' && version.trim().length > 0
		? version.trim()
		: 'unknown'
}
