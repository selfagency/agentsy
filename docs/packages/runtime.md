# `@agentsy/runtime`

- **Status:** Published
- **Role:** Runtime loop execution, checkpoints, interruption, AG-UI projection, and helper execution mechanics

## Where it fits

Use `@agentsy/runtime` when your application needs resumable task execution, workflow execution, runtime lifecycle hooks, or helper/background work execution under a runtime boundary.

## Boundary rule

`@agentsy/runtime` owns execution mechanics. Higher-level helper-role semantics and policies are defined by `@agentsy/orchestrator`.
