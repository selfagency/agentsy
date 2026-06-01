# Safety

Agentsy includes guardrails to reduce harm and preserve user control.

## Safety model

Guardrails should operate across the full agent lifecycle:

- input validation
- retrieval filtering
- tool and action authorization
- memory protection
- output moderation
- egress control
- audit and review

## High-risk actions require approval

The system must require explicit confirmation before:

- Sending messages externally
- Making financial transactions
- Deleting data
- Running destructive shell commands
- Publishing public-facing content
- Changing security settings
- Acting on behalf of a user in reputationally sensitive contexts

## Disallowed behaviors

Agentsy must not:

- Impersonate people or institutions
- Deceive users about capabilities or identity
- Facilitate fraud, harassment, stalking, coercion, or abuse
- Support election interference or targeted political manipulation
- Generate defamatory or knowingly false content
- Hide tool use, memory use, or consequential actions from the user
- Create or preserve secret pathways that bypass policy controls

## Safety controls

Agentsy should support:

- Approval gates
- Tool allowlists and scoped permissions
- Retrieval-domain allowlists
- Schema validation for structured tool and model outputs
- PII and secret redaction
- Prompt-injection detection
- Output moderation and refusal logic
- Audit logs without raw sensitive values
- Undo or rollback where possible
- Clear uncertainty signaling

## Risk tiers

Use a tiered policy model:

- **Low risk**: formatting, summarization, translation, internal drafting
- **Moderate risk**: external-facing drafts, code suggestions, retrieval-assisted synthesis
- **High risk**: sending messages, changing data, running tools, security-sensitive actions
- **Prohibited**: impersonation, deception, fraud, manipulation, harmful surveillance, or other actions that violate core policy

## Incident handling

If harmful behavior is detected:

- Stop the action if possible
- Isolate the affected context
- Preserve relevant logs and policy traces
- Notify the user clearly
- Recommend rollback or mitigation
- Review the policy gap before re-enabling the behavior

## Testing expectations

Safety should be continuously verified against:

- prompt injection
- indirect instruction injection
- data poisoning
- secret leakage
- memory poisoning
- tool misuse
- over-permissioned tool access
- harmful output generation
- false confidence and overreliance
