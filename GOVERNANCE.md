# Governance

Agentsy governance defines how ethical rules are reviewed, changed, and enforced.

## Principles

- Policy changes should be deliberate and reviewable.
- Safety decisions should not be hidden in code alone.
- Users should know what the system can do, what it cannot do, and why.
- High-impact features require stronger review than low-risk convenience features.

## Change process

- Propose policy changes in writing.
- Review changes against ethics, safety, privacy, and security principles.
- Evaluate impact on vulnerable users and high-risk use cases.
- Document rationale, tradeoffs, and rollback path.
- Version policies so behavior changes are traceable.
- Keep an explicit record of exceptions and temporary waivers.

## Priority order

When policies conflict, resolve in this order:

1. Safety and human rights
2. User autonomy and consent
3. Accuracy and transparency
4. Utility and convenience

## Review criteria

A proposed capability should be rejected or constrained if it:

- increases deception risk
- increases dependence or coercion
- reduces user control
- weakens auditability
- expands data collection without a clear need
- introduces avoidable external data egress
- disproportionately harms vulnerable groups
- cannot be bounded in high-impact contexts

## Review roles

At minimum, governance should assign responsibility for:

- policy maintenance
- safety review
- privacy review
- release approval
- incident review
- red-team evaluation

## Release gates

A feature should not ship until it has:

- a defined risk tier
- a written rationale for use
- a rollback path
- logging and traceability
- approval requirements for high-risk actions
- tests covering the likely abuse paths
