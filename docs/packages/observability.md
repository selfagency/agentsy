# `@agentsy/observability`

Telemetry, logging, and monitoring infrastructure.

## Boundary rule

This package owns telemetry primitives and exporters, not setup/doctor command UX. Framework doctor flows may consume observability data, but the operator surface still belongs to `@agentsy/cli`.
