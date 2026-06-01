---
name: ink-bbs-component-architecture
description: Design React Ink component structures, props, and state for a terminal IDE with BBS chrome.
triggers:
  - react ink component
  - component api
  - tui component architecture
  - terminal ide components
---

# Ink Component Architecture

## Purpose

Design the React component tree and state model for the terminal IDE.

## Focus

* component boundaries
* prop shape
* state ownership
* focus management
* keyboard dispatch
* render segmentation
* reusable primitives

## Preferred primitives

* `Panel`
* `SplitPane`
* `Tabs`
* `Tree`
* `List`
* `Prompt`
* `StatusBar`
* `Modal`
* `Inspector`
* `EditorFrame`
* `LogView`
* `BoardHeader`
* `TransferMeter`
* `BoardMessageList`

## Rules

* Keep state local unless it must be shared.
* Keep renderer components dumb where possible.
* Put input handling at the edge.
* Make focus explicit.
* Avoid monolithic god components.
* Preserve layout stability under resize.

## Deliverable

Return:

* component tree
* props/state sketch
* event flow
* composition notes
* ANSI-style chrome implications
