#!/usr/bin/env node
import { runCli } from './index.js';

try {
  const argv = process.argv.slice(2);
  const exitCode = await runCli(argv);
  process.exit(exitCode);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
