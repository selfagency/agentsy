# Changelog

All notable changes to `@agentsy/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-04

## What's Changed
* refactor: migrate to @agentsy monorepo and rename @agentsy/parser to @agentsy/core by @selfagency in https://github.com/selfagency/agentsy/pull/49
* docs: move release guide to developer docs by @selfagency in https://github.com/selfagency/agentsy/pull/50


**Full Changelog**: https://github.com/selfagency/agentsy/compare/v0.3.1...@agentsy/core@0.1.0


## [0.1.0] - 2025-01-16

### Added

- Initial release of `@agentsy/core`
- LLM stream parsing and structured output extraction
- Event converter and state management for agent UI feedback
- Reasoning mapper for o1-style thinking tokens
- Context XML utilities for system prompt construction
- Tool call extraction and schema validation
- SSE (Server-Sent Events) stream handling
- Markdown and text formatting utilities
- Recovery mechanisms for malformed LLM output
- Support for Claude, GPT, and Grok models via adapters
- Comprehensive test coverage (87.36%)
