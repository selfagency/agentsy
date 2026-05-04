# @agentsy/ag-ui

AG-UI protocol mapping and adapter helpers.

## Purpose

`@agentsy/ag-ui` adapts agent/stream events into AG-UI-compatible event flows.

## Role in Agentsy

Used when integrating Agentsy output with AG-UI clients and protocol-aware frontends.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { mapToAgUiEvent } from '@agentsy/ag-ui';

const event = mapToAgUiEvent(processorEvent);
```

## Development

```bash
cd packages/ag-ui
pnpm build
pnpm check-types
pnpm test
```
