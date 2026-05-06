# Changelog

All notable changes to `@agentsy/vscode` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added new subpath exports for modular APIs in `@agentsy/vscode` package.
- Introduced new APIs: MCPChatBridge, VSCodeMCPBridgeHelper, RetryUtility, VSCodeChatResponseStream overloads.
- Created detailed migration guides for upgrading from v0.x to v1.
- Added production-style example usage in docs.
- Updated `docs/getting-started.md` with dependency matrix and modern usage patterns.

### Improved

- Improved developer experience by modularizing exports and enhancing MCP streaming integration.
- Added extensive documentation for new submodules and usage guides.

## [0.1.1] - 2026-05-05

**Full Changelog**: <https://github.com/selfagency/agentsy/compare/@agentsy/agent@0.1.1...@agentsy/vscode@0.1.1>

## [0.1.0] - 2025-01-16

### Added

- Initial release of `@agentsy/vscode`
- VS Code extension scaffolding and utilities
- Message conversion layer for seamless integration with core parser
- API key manager for secure credential handling
- Provider integration for multiple LLM models
- Error handling utilities for extension lifecycle
- Settings and configuration management
- Usage tracking and telemetry utilities
- VS Code renderer for agent output display
- MCP (Model Context Protocol) integration support
- Comprehensive test coverage (76.56%)
