# @agentsy/core

Core stream-processing primitives used across Agentsy packages.

## Status

Published package with strict TypeScript contracts.

## Phase 0 context compression utility

The core context module now exports memory-file compression helpers:

- `compressMemoryContent(content)`
- `compressMemoryFile(filePath, options)`

Use the `@agentsy/core/context` subpath for these APIs.
