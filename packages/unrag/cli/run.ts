import { intro, outro } from "@clack/prompts";
import { initCommand } from "./commands/init";
import { addCommand } from "./commands/add";

export async function run(argv: string[]) {
  const [, , command, ...rest] = argv;

  intro("unrag");

  if (!command || command === "help" || command === "--help" || command === "-h") {
    outro(["Usage:", "", "- unrag init", "- unrag add <connector>"].join("\n"));
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

  outro(`Unknown command: ${command}`);
  process.exitCode = 1;
}


