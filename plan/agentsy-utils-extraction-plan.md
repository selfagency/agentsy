# Agentsy Utilities Extraction Plan

This document outlines a comprehensive plan to extract essential common utilities and features from the `opilot` provider (and related) into the Agentsy project for better reuse, modularity, and maintainability.

## 1. Stable Tool Call ID Mapping Utilities Extraction

- **Goal:** Create shared utilities for bidirectional mapping between provider-native tool call IDs and VS Code tool call IDs.
- **Actions:**
  - Extract the tool call ID mapping logic (maps, ID generation, lookup methods) from the provider into a standalone module under `@agentsy/tool-calls` or a new utilities package.
  - Generalize the ID generation to be robust and cryptographically safe.
  - Provide methods for mapping tool calls and tool results using this ID mapping.
- **Outcome:** All adapters can share consistent stable tool call ID mapping.

---

## 2. Embedded Token Parsing for Tool Calls

- **Goal:** Centralize parsing of embedded tool call tokens in streaming text.
- **Actions:**
  - Extract `parseTextEmbeddedToolCalls` logic to a utility function module under `@agentsy/adapters` or `@agentsy/tool-calls`.
  - Make it configurable with callbacks or hooks for warnings and errors.
  - Generalize handling for partial or malformed streams and JSON parsing.
- **Outcome:** Generic streaming token parser usable by multiple adapter packages.

---

## 3. API Key Management Utilities

- **Goal:** Generalize key prompting, validation, and secret storage for language model adapters.
- **Actions:**
  - Extract VS Code secret storage interaction code to `@agentsy/vscode` with API-agnostic interfaces.
  - Provide fallback environment variable loading with test-mode flags.
  - Create reusable API key manager classes implementing these mechanisms.
- **Outcome:** Standard API key management for all Agentsy integrations.

---

## 4. Usage Metrics Reporting

- **Goal:** Share consistent usage token reporting via structured `LanguageModelDataPart`.
- **Actions:**
  - Extract usage metrics construction and reporting helpers into an Agentsy utility package.
  - Support custom MIME types for specialized metrics (e.g., token counts).
  - Add usage reporting examples and integration points.
- **Outcome:** Unified usage metrics visibility across adapters.

---

## 5. Streaming Handling Utilities

- **Goal:** Centralize streaming message normalization, tool call delta accumulation, and fallback management.
- **Actions:**
  - Enhance and extend existing `ToolCallAccumulator` to cover all edge cases.
  - Extract stream parsing wrappers and XML fallback handling to `@agentsy/adapters` packages.
  - Provide generic streaming adapters with callbacks/handlers for content, errors, and reasoning parts.
- **Outcome:** SHared, robust streaming processing with flexible integration hooks.

---

## 6. Error Handling & Messaging

- **Goal:** Standardize error classification, mapping to friendly user messages, and VS Code specific error subtypes.
- **Actions:**
  - Extract HTTP status to user message mapping and error classification functions.
  - Migrate VS Code error subtype wrapping and diagnostics logging to utilities.
  - Provide utility functions for other extensions to reuse and extend.
- **Outcome:** Unified error handling framework across all Agentsy adapters.

---

## 7. Model Info Caching and Refresh

- **Goal:** Standardize model metadata caching, pruning, and refresh throttling.
- **Actions:**
  - Extract caching mechanisms, TTL management, and pruning functions.
  - Provide event emitters or hooks for model info change notifications.
  - Support configurable refresh intervals and cache invalidation.
- **Outcome:** Consistent performant model list handling.

---

## Implementation and Integration Plan

1. Identify and isolate each feature/module in `opilot/src/provider.ts`.
2. Create new packages or extend existing ones (`@agentsy/tool-calls`, `@agentsy/adapters`, `@agentsy/vscode`) to hold extracted modules.
3. Write modular, well-typed, and test-covered implementations of each extracted feature.
4. Refactor `opilot` and other adapters incrementally to consume the shared utilities.
5. Update existing tests and add new ones to cover shared utility functionality.
6. Update documentation for these reusable utilities detailing API, usage, and extension points.
7. Incorporate migration guides to assist adopting these shared utilities.
8. Monitor usage and collect feedback for further refinements or decomposition.

---

This plan will unify core common code, reduce duplication, and strengthen maintainability across your Agentsy ecosystem.

Please let me know if you want me to generate detailed change lists or start implementing any of these extraction steps now.
