#!/usr/bin/env node
import { runCli } from './index.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const exitCode = await runCli(argv);
  process.exit(exitCode);
}

main();
