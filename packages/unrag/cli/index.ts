#!/usr/bin/env node
import { run } from "@cli/run";

run(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});


