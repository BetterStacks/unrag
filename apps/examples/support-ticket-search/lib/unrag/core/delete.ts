import type { DeleteInput, ResolvedContextEngineConfig } from "./types";

export const deleteDocuments = async (
  config: ResolvedContextEngineConfig,
  input: DeleteInput
): Promise<void> => {
  const hasSourceId = "sourceId" in input && typeof input.sourceId === "string";
  const hasPrefix =
    "sourceIdPrefix" in input && typeof input.sourceIdPrefix === "string";

  if (hasSourceId === hasPrefix) {
    // Both true or both false.
    throw new Error('Provide exactly one of "sourceId" or "sourceIdPrefix".');
  }

  await config.store.delete(input);
};


