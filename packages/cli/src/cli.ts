#!/usr/bin/env node
import { runCli } from './index.js';

const argv = process.argv.slice(2);
runCli(argv).then(
  exitCode => process.exit(exitCode),
  error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
);
