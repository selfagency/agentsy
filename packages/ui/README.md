# @agentsy/ui

Conversation state and event-store helpers.

## Purpose

`@agentsy/ui` provides reducer/store primitives for applying conversation events to UI state.

## Role in Agentsy

This package bridges processing/agent events into deterministic UI state updates for consumer applications.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you want deterministic conversation state derived from processor or agent events.

Typical neighbors:

- `@agentsy/processor`
- `@agentsy/renderers`
- `@agentsy/vscode`

## API overview

- `createConversationStore`
- `createConversationStoreFromProcessor`
- `bindProcessorToConversationStore`
- `applyConversationEvent`

## Usage

```ts
import { createConversationStore, applyConversationEvent } from '@agentsy/ui';

const store = createConversationStore('conversation-1');
store.dispatch(event);
```

## Learn more

- [Package page](https://agentsy.self.agency/packages/ui)

## Development

```bash
cd packages/ui
pnpm build
pnpm check-types
pnpm test
```
