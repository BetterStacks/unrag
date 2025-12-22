import { deleteDocuments } from "./delete";
import { ingest, planIngest } from "./ingest";
import { retrieve } from "./retrieve";
import { defineConfig, resolveConfig } from "./config";
import type {
  ContextEngineConfig,
  DeleteInput,
  IngestInput,
  IngestResult,
  IngestPlanResult,
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

  /**
   * Dry-run for ingestion. Returns which assets would be processed and by which extractors,
   * without calling external services.
   *
   * Note: chunk counts/embeddings are not produced in dry-run.
   */
  async planIngest(input: IngestInput): Promise<IngestPlanResult> {
    return planIngest(this.config, input);
  }

  async retrieve(input: RetrieveInput): Promise<RetrieveResult> {
    return retrieve(this.config, input);
  }

  async delete(input: DeleteInput): Promise<void> {
    return deleteDocuments(this.config, input);
  }
}

export const createContextEngine = (config: ContextEngineConfig) =>
  new ContextEngine(config);

export { defineConfig };


