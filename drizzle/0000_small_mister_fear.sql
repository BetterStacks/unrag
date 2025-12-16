CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"idx" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"org_id" text,
	"project_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"chunk_id" uuid NOT NULL,
	"embedding" vector,
	"embedding_dimension" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "embeddings_chunk_id_pk" PRIMARY KEY("chunk_id")
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;