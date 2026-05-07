# Migration Guide

This document describes notable changes and migration steps for the Agentsy modular ecosystem moving from version 0.1.x to 0.2.x.

## Major Changes

- Package structure refactored into multiple submodules with independent exports
- New subpath exports added for core modules, streaming bridges, retry utilities, integrations, and helpers
- Stable tool call ID mapping and validation centralized into `@agentsy/adapters`
- Robust retry logic implemented and exposed in a new `@agentsy/retry` package
- Redesigned streaming bridge utilities to improve resilience and flexibility

## Migration Steps

1. Update your imports to use new modular subpath exports, e.g.,

```ts

```

- import { createVSCodeChatRenderer } from '@agentsy/vscode';

```
 + import { createVSCodeChatRenderer } from '@agentsy/vscode/renderer';
```

2. Replace retry logic imports and usage with the new `@agentsy/retry` package APIs.

3. Use the centralized `toMistralMessages` and related message transformation utilities from `@agentsy/adapters` where applicable.

4. Adjust your integration code to leverage the redesigned streaming bridge utilities from `@agentsy/stream-bridge`.

5. Upgrade your package dependencies to `^0.2.0` or later to ensure compatibility with new APIs.

6. Refer to updated documentation and examples for configuration and usage patterns.

## Decision Tree

- If your integration involves chat streaming, use the new streaming bridge utilities.
- If you require stable tool call ID mapping and validation, adopt utilities from `@agentsy/adapters`.
- For retry and resilience patterns, use the APIs provided by `@agentsy/retry`.

## Additional Resources

For detailed migration and usage information, please consult the updated API documentation and example projects:

- [Agentsy API documentation](https://agentsy.com/docs/api)
- [Examples and guides](https://agentsy.com/docs/examples)

---

This migration guide will be updated as the `0.2.x` release matures.
