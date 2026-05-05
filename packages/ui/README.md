# @agentsy/ui

Conversation state and event-store helpers.

## Purpose

`@agentsy/ui` provides reducer/store primitives for applying conversation events to UI state.

## Role in Agentsy

This package bridges processing/agent events into deterministic UI state updates for consumer applications.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { createConversationStore, applyConversationEvent } from '@agentsy/ui';

const store = createConversationStore();
store.dispatch(event);
```

## Development

```bash
cd packages/ui
pnpm build
pnpm check-types
pnpm test
```
