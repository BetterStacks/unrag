import { intro, outro } from "@clack/prompts";
import { initCommand } from "./commands/init";
import { addCommand } from "./commands/add";
import { UNRAG_GITHUB_REPO_URL, docsUrl } from "./lib/constants";

function renderHelp() {
  return [
    "unrag — vendor-in RAG primitives (ingest/retrieve + adapters) into your repo.",
    "",
    "Usage:",
    "  bunx unrag <command> [options]",
    "  npx  unrag <command> [options]",
    "",
    "Commands:",
    "  init                Install core files (config + store adapter templates)",
    "  add <connector>     Install a connector (currently: notion)",
    "  help                Show this help",
    "",
    "Global options:",
    "  -h, --help           Show help",
    "  -y, --yes            Non-interactive; accept defaults",
    "",
    "init options:",
    "  --store <adapter>    drizzle | prisma | raw-sql",
    "  --dir <path>         Install directory (alias: --install-dir)",
    "  --alias <@name>      Import alias base (e.g. @unrag)",
    "  --rich-media         Enable rich media setup (also enables multimodal embeddings)",
    "  --no-rich-media      Disable rich media setup",
    "  --extractors <list>  Comma-separated extractors (implies --rich-media)",
    "",
    "Examples:",
    "  bunx unrag@latest init",
    "  bunx unrag@latest init --yes --store drizzle --dir lib/unrag --alias @unrag",
    "  bunx unrag@latest init --yes --rich-media",
    "  bunx unrag@latest init --yes --extractors pdf-text-layer,file-text",
    "  bunx unrag add notion --yes",
    "",
    "Docs:",
    `  - Quickstart: ${docsUrl("/docs/getting-started/quickstart")}`,
    `  - CLI:       ${docsUrl("/docs/reference/cli")}`,
    `  - Notion:    ${docsUrl("/docs/connectors/notion")}`,
    "",
    "Repo:",
    `  ${UNRAG_GITHUB_REPO_URL}`,
    "",
    "Tip:",
    "  After `init`, open the generated unrag.md for schema + env vars (DATABASE_URL).",
  ].join("\n");
}

export async function run(argv: string[]) {
  const [, , command, ...rest] = argv;

  intro("unrag");

  if (!command || command === "help" || command === "--help" || command === "-h") {
    outro(renderHelp());
    return;
  }

  if (command === "init") {
    await initCommand(rest);
    return;
  }

  if (command === "add") {
    await addCommand(rest);
    return;
  }

  outro([`Unknown command: ${command}`, "", renderHelp()].join("\n"));
  process.exitCode = 1;
}


