import { intro, outro } from "@clack/prompts";
import { initCommand } from "./commands/init";

export async function run(argv: string[]) {
  const [, , command, ...rest] = argv;

  intro("unrag");

  if (!command || command === "help" || command === "--help" || command === "-h") {
    outro("Usage: unrag init");
    return;
  }

  if (command === "init") {
    await initCommand(rest);
    return;
  }

  outro(`Unknown command: ${command}`);
  process.exitCode = 1;
}


