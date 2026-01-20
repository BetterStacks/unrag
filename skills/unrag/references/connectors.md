# Connectors

Connectors sync content from external services (Notion, Google Drive, OneDrive, Dropbox) into your RAG system.

## Available Connectors

| Connector | Status | Description |
|-----------|--------|-------------|
| **Notion** | Available | Pages, databases, blocks |
| **Google Drive** | Available | Docs, Sheets, folders |
| **OneDrive** | Available | Microsoft files, folders |
| **Dropbox** | Available | Files, folders |
| GitHub | Coming Soon | Repos, docs, issues |
| GitLab | Coming Soon | Repos, wiki pages |
| Slack | Coming Soon | Channels, threads |
| Discord | Coming Soon | Server channels |
| Linear | Coming Soon | Issues, projects |
| Microsoft Teams | Coming Soon | Channels, conversations |

## Installation

```bash
# Add a connector
bunx unrag@latest add connector notion
bunx unrag@latest add connector google-drive
```

---

## Notion Connector

Sync pages, databases, and blocks from Notion workspaces.

### Setup

```bash
bunx unrag@latest add connector notion
```

**Dependencies:** `@notionhq/client`

**Environment:**
```bash
NOTION_TOKEN="secret_..."  # Internal integration token
```

### Creating an Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the "Internal Integration Token"
4. Share pages/databases with the integration

### Usage

```ts
import { createNotionConnector } from "./lib/unrag/connectors/notion";
import { createUnragEngine } from "@unrag/config";

const notion = createNotionConnector({
  auth: process.env.NOTION_TOKEN,
});

const engine = createUnragEngine();

// Sync specific pages
const stream = notion.syncPages({
  pageIds: ["page-id-1", "page-id-2"],
});

await engine.runConnectorStream({ stream });

// Sync a database
const dbStream = notion.syncDatabase({
  databaseId: "database-id",
  filter: { property: "Status", status: { equals: "Published" } },
});

await engine.runConnectorStream({ stream: dbStream });
```

### Notion Connector Options

```ts
// syncPages options
{
  pageIds: string[];
  includeChildren?: boolean;  // Include child pages
}

// syncDatabase options
{
  databaseId: string;
  filter?: NotionFilter;      // Notion API filter
  sorts?: NotionSort[];       // Notion API sorts
}
```

---

## Google Drive Connector

Sync Docs, Sheets, and folders from Google Drive.

### Setup

```bash
bunx unrag@latest add connector google-drive
```

**Dependencies:** `googleapis`, `google-auth-library`

**Environment (Service Account):**
```bash
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

**Environment (OAuth):**
```bash
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/callback"
```

### Usage

```ts
import { createGoogleDriveConnector } from "./lib/unrag/connectors/google-drive";
import { createUnragEngine } from "@unrag/config";

// With service account
const drive = createGoogleDriveConnector({
  auth: {
    type: "service-account",
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  },
});

// Or with OAuth tokens
const driveOAuth = createGoogleDriveConnector({
  auth: {
    type: "oauth",
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    accessToken: userAccessToken,
    refreshToken: userRefreshToken,
  },
});

const engine = createUnragEngine();

// Sync a folder
const stream = drive.syncFolder({
  folderId: "folder-id",
  recursive: true,
  mimeTypes: [
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
  ],
});

await engine.runConnectorStream({ stream });

// Sync specific files
const fileStream = drive.syncFiles({
  fileIds: ["file-id-1", "file-id-2"],
});

await engine.runConnectorStream({ stream: fileStream });
```

### Google Drive Connector Options

```ts
// syncFolder options
{
  folderId: string;
  recursive?: boolean;        // Include subfolders
  mimeTypes?: string[];       // Filter by MIME type
  modifiedAfter?: Date;       // Only modified after
}

// syncFiles options
{
  fileIds: string[];
}
```

---

## OneDrive Connector

Sync files and folders from Microsoft OneDrive.

### Setup

```bash
bunx unrag@latest add connector onedrive
```

**Environment:**
```bash
AZURE_TENANT_ID="..."
AZURE_CLIENT_ID="..."
AZURE_CLIENT_SECRET="..."
```

### Azure AD App Setup

1. Register app in [Azure Portal](https://portal.azure.com)
2. Add API permissions: `Files.Read`, `Files.Read.All`
3. Create client secret
4. Configure redirect URIs

### Usage

```ts
import { createOneDriveConnector } from "./lib/unrag/connectors/onedrive";
import { createUnragEngine } from "@unrag/config";

const onedrive = createOneDriveConnector({
  tenantId: process.env.AZURE_TENANT_ID!,
  clientId: process.env.AZURE_CLIENT_ID!,
  clientSecret: process.env.AZURE_CLIENT_SECRET!,
  accessToken: userAccessToken,  // From OAuth flow
});

const engine = createUnragEngine();

// Sync a folder
const stream = onedrive.syncFolder({
  driveId: "me",  // or specific drive ID
  path: "/Documents/Knowledge Base",
  recursive: true,
});

await engine.runConnectorStream({ stream });
```

---

## Dropbox Connector

Sync files and folders from Dropbox.

### Setup

```bash
bunx unrag@latest add connector dropbox
```

**Environment:**
```bash
DROPBOX_CLIENT_ID="..."
DROPBOX_CLIENT_SECRET="..."
```

### Usage

```ts
import { createDropboxConnector } from "./lib/unrag/connectors/dropbox";
import { createUnragEngine } from "@unrag/config";

const dropbox = createDropboxConnector({
  clientId: process.env.DROPBOX_CLIENT_ID!,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
  accessToken: userAccessToken,  // From OAuth flow
});

const engine = createUnragEngine();

// Sync a folder
const stream = dropbox.syncFolder({
  path: "/Knowledge Base",
  recursive: true,
});

await engine.runConnectorStream({ stream });
```

---

## ConnectorStream Pattern

All connectors emit a `ConnectorStream` - an async iterable of events:

```ts
type ConnectorStreamEvent<TCheckpoint> =
  | { type: "upsert"; sourceId: string; content: string; metadata?: Metadata; assets?: AssetInput[] }
  | { type: "delete"; sourceId?: string; sourceIdPrefix?: string }
  | { type: "progress"; message: string; progress?: number }
  | { type: "warning"; message: string }
  | { type: "checkpoint"; checkpoint: TCheckpoint };
```

### Event Types

**`upsert`** - Ingest or update a document
```ts
{
  type: "upsert",
  sourceId: "notion:page:abc123",
  content: "Page content...",
  metadata: { title: "My Page", url: "https://..." },
  assets: [{ assetId: "img1", kind: "image", data: { kind: "url", url: "..." } }],
}
```

**`delete`** - Remove a document
```ts
{ type: "delete", sourceId: "notion:page:abc123" }
// or delete by prefix
{ type: "delete", sourceIdPrefix: "notion:page:" }
```

**`progress`** - Progress update
```ts
{ type: "progress", message: "Syncing page 5 of 100", progress: 0.05 }
```

**`warning`** - Non-fatal issue
```ts
{ type: "warning", message: "Could not access page xyz" }
```

**`checkpoint`** - Resume point for incremental sync
```ts
{ type: "checkpoint", checkpoint: { cursor: "abc", timestamp: 1234567890 } }
```

---

## Using runConnectorStream

```ts
const result = await engine.runConnectorStream({
  stream,

  // Progress callback
  onProgress: (event) => {
    console.log(`[${event.type}] ${event.message || ""}`);
  },

  // Abort signal for cancellation
  signal: abortController.signal,

  // Resume from previous checkpoint
  checkpoint: savedCheckpoint,
});

// Result
console.log(`Ingested: ${result.ingestCount}`);
console.log(`Deleted: ${result.deleteCount}`);
console.log(`Warnings: ${result.warnings.length}`);

// Save checkpoint for next sync
await saveCheckpoint(result.checkpoint);
```

---

## Checkpoint-Based Resumption

Connectors support checkpoints for incremental sync and serverless resumption:

```ts
// First sync
const result1 = await engine.runConnectorStream({ stream: notion.syncDatabase({ databaseId }) });
await db.saveCheckpoint("notion-sync", result1.checkpoint);

// Later: resume from checkpoint
const savedCheckpoint = await db.loadCheckpoint("notion-sync");
const result2 = await engine.runConnectorStream({
  stream: notion.syncDatabase({
    databaseId,
    since: savedCheckpoint?.lastModified,  // Only changes
  }),
  checkpoint: savedCheckpoint,
});
```

---

## Building Custom Connectors

Implement a connector as an async generator:

```ts
import type { ConnectorStreamEvent, AssetInput, Metadata } from "@unrag/types";

type MyCheckpoint = {
  cursor?: string;
  lastSync: number;
};

async function* myConnector(options: MyOptions): AsyncGenerator<ConnectorStreamEvent<MyCheckpoint>> {
  const client = createMyClient(options);

  yield { type: "progress", message: "Starting sync..." };

  const items = await client.listItems({ after: options.cursor });

  for (const item of items) {
    if (item.deleted) {
      yield { type: "delete", sourceId: `my-source:${item.id}` };
    } else {
      yield {
        type: "upsert",
        sourceId: `my-source:${item.id}`,
        content: item.content,
        metadata: { title: item.title, url: item.url },
        assets: item.attachments?.map(a => ({
          assetId: a.id,
          kind: detectKind(a.mimeType),
          data: { kind: "url", url: a.url, mediaType: a.mimeType },
        })),
      };
    }

    // Emit checkpoints periodically
    yield {
      type: "checkpoint",
      checkpoint: { cursor: item.id, lastSync: Date.now() },
    };
  }
}
```

---

## Source ID Conventions

Connectors should use consistent sourceId patterns:

```
{connector}:{type}:{id}

Examples:
- notion:page:abc123
- notion:database:xyz789:row:123
- gdrive:doc:1234567890
- dropbox:file:/Documents/report.pdf
```

This enables:
- Prefix-based deletion (`sourceIdPrefix: "notion:"`)
- Scoped retrieval (`scope: { sourceId: "gdrive:" }`)
- Easy debugging and tracing
