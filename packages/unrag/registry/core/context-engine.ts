import { ingest } from "./ingest";
import { retrieve } from "./retrieve";
import { defineConfig, resolveConfig } from "./config";
import type {
  ContextEngineConfig,
  IngestInput,
  IngestResult,
  ResolvedContextEngineConfig,
  RetrieveInput,
  RetrieveResult,
} from "./types";

export class ContextEngine {
  private readonly config: ResolvedContextEngineConfig;

  constructor(config: ContextEngineConfig) {
    this.config = resolveConfig(config);
  }

  async ingest(input: IngestInput): Promise<IngestResult> {
    return ingest(this.config, input);
  }

  async retrieve(input: RetrieveInput): Promise<RetrieveResult> {
    return retrieve(this.config, input);
  }
}

export const createContextEngine = (config: ContextEngineConfig) =>
  new ContextEngine(config);

export { defineConfig };


