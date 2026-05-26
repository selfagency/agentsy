---
name: ink-bbs-interaction-validation
description: Validate keyboard flow, focus behavior, resize behavior, ANSI readability, and terminal usability for Ink BBS-style UIs.
triggers:
  - keyboard navigation
  - focus validation
  - terminal ux
  - ink testing
  - tui validation
---

# BBS Interaction Validation

## Purpose

Validate that the terminal IDE is usable and feels right.

## Check

* keyboard-only navigation
* focus visibility
* tab order
* modal behavior
* resize handling
* overflow handling
* command entry
* tree/list navigation
* pane activation
* status feedback
* ANSI-style readability

## Rules

* Every visible action should be reachable from keyboard.
* Focus must always be obvious.
* Resizing should not destroy layout.
* Errors must be readable, not subtle.
* The BBS feel must not break usability.
* ANSI styling must not hide semantics.

## Deliverable

Return:

* pass/fail summary
* UX risks
* keyboard gaps
* resize issues
* style regressions
* recommended fixes
