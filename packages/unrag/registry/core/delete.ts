import type { DeleteInput, ResolvedContextEngineConfig } from "@registry/core/types";
import { getDebugEmitter } from "@registry/core/debug-emitter";

const now = () => performance.now();

export const deleteDocuments = async (
  config: ResolvedContextEngineConfig,
  input: DeleteInput
): Promise<void> => {
  const debug = getDebugEmitter();

  const hasSourceId = "sourceId" in input && typeof input.sourceId === "string";
  const hasPrefix =
    "sourceIdPrefix" in input && typeof input.sourceIdPrefix === "string";

  if (hasSourceId === hasPrefix) {
    // Both true or both false.
    throw new Error('Provide exactly one of "sourceId" or "sourceIdPrefix".');
  }

  const mode = hasSourceId ? "sourceId" : "sourceIdPrefix";
  const value = hasSourceId
    ? (input as { sourceId: string }).sourceId
    : (input as { sourceIdPrefix: string }).sourceIdPrefix;

  debug.emit({
    type: "delete:start",
    mode,
    value,
  });

  const start = now();
  await config.store.delete(input);
  const durationMs = now() - start;

  debug.emit({
    type: "delete:complete",
    mode,
    value,
    durationMs,
  });
};


