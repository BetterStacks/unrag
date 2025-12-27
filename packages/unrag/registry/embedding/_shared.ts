import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function requireOptional<T = any>(args: {
  id: string;
  installHint: string;
  providerName: string;
}): T {
  try {
    return require(args.id) as T;
  } catch {
    throw new Error(
      `Unrag embedding provider "${args.providerName}" requires "${args.id}" to be installed.\n` +
        `Install it with: ${args.installHint}`
    );
  }
}


