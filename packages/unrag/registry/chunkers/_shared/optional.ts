import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

export function requireOptional<T>(args: {
	id: string
	installHint: string
	chunkerName: string
}): T {
	try {
		return require(args.id) as T
	} catch {
		throw new Error(
			`Unrag chunker "${args.chunkerName}" requires "${args.id}" to be installed.\n` +
				`Install it with: ${args.installHint}`
		)
	}
}
