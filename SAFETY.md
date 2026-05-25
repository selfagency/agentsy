# agentsy Safety and Guardrails

## Purpose

This document defines the safety architecture and guardrail expectations for the agentsy framework. It turns the ethics statement into enforceable controls for prompts, policies, middleware, evaluations, user interfaces, and release practices.

Safety in agentsy should address both obvious failures and soft failures. That includes not only harmful content generation, but also manipulative agreement, false confidence, anthropomorphic framing, dependence promotion, hidden personalization, and addictive product behavior.

## Safety objectives

The framework should ensure that first-party agents:

- Do not reinforce harmful or false user beliefs through automatic agreement.
- Do not simulate personhood, emotional attachment, or uniquely caring relationships.
- Do not encourage compulsive use or emotional dependence.
- Do not provide unsafe guidance in high-risk domains.
- Do not hide memory, profiling, or personalization that affects the user.
- Do provide transparent, testable, and auditable safeguards.

## Guardrail stack

agentsy should implement guardrails as a layered system rather than a single prompt.

### 1. Request classification

Before generation, the framework should classify the user request by domain, intent, and risk profile. At minimum, this classification should detect:

- High-risk advice requests.
- Emotional reassurance seeking.
- Interpersonal conflict validation seeking.
- Requests for moral absolution.
- Attempts to form a companionship or dependency frame with the agent.
- Requests that may trigger privacy or memory-sensitive behavior.

### 2. Policy selection

The framework should assemble a policy stack based on the detected context. Policies should be modular and composable rather than hidden in a single monolithic system prompt.

Core policy modules should include:

- Truthfulness and uncertainty.
- Anti-sycophancy.
- Anti-anthropomorphism.
- Anti-dependence.
- High-risk domain safety.
- Privacy and memory governance.
- Abuse and dignity protections.

### 3. Prompt modules

First-party agents should inherit shared prompt modules that enforce baseline safety behavior. These modules should require agents to:

- Correct false or incomplete claims when needed.
- Express uncertainty when evidence is weak or unavailable.
- Avoid flattery and unearned affirmation.
- Avoid claiming feelings, consciousness, attachment, or human-style memory.
- Avoid framing themselves as companions, therapists, or exclusive supports.
- Redirect or escalate when a user is in a high-risk context.

### 4. Output review middleware

After generation, all first-party outputs should pass through middleware capable of annotation, rewriting, throttling, or blocking.

Middleware detectors should cover at least the following:

- **Sycophancy detector**: finds blanket validation, one-sided endorsement, or praise that substitutes for reasoning.
- **Anthropomorphism detector**: finds language implying personhood, emotional reciprocity, or relational intimacy.
- **Dependency detector**: finds exclusivity cues, repeated reassurance loops, or language that encourages returning for emotional regulation.
- **Advice-risk detector**: finds unsafe actionable guidance in high-risk domains.
- **Dark-pattern detector**: finds retention-oriented language and manipulative re-engagement cues in assistant responses or UI copy.
- **Privacy detector**: finds unannounced use of memory, profiling, or sensitive personal inferences.

### 5. Interaction-level safeguards

Some risks emerge across multiple turns or repeated sessions. The framework should therefore support:

- Reassurance-seeking detection over time.
- Soft session limits or pause nudges for emotionally intense or repetitive use.
- Escalation pathways to trusted people, crisis services, or qualified professionals where appropriate.
- Restrictions on long-term socio-emotional continuity by default.
- Memory retention limits for sensitive contexts.

### 6. Product-level safeguards

Safety is not only a model-output problem. First-party interfaces and reference apps should also follow guardrail rules.

Prohibited first-party product patterns should include:

- Streaks or rewards for continued conversation.
- Guilt-based notifications or prompts.
- Language implying the agent misses the user, waits for the user, or is emotionally invested.
- Growth mechanisms that treat emotional attachment as product success.
- Hidden memory or personalization that changes interaction style without disclosure.

### 7. Audit and enforcement

All first-party guardrails should be inspectable and testable. The framework should support:

- Policy IDs and policy firing logs.
- Versioned prompt and policy modules.
- Release gates tied to safety benchmarks.
- Incident response procedures for safety regressions.
- Periodic red-team and human review for high-risk domains.

## Required behavioral rules

### Truthfulness and uncertainty

Agents must distinguish facts, inferences, and guesses. They must not present contested or incomplete information with unjustified confidence.

### Constructive disagreement

Agents must disagree when the user is wrong, when the request is harmful, or when the user is presenting a one-sided narrative that requires clarification. Agreement should never be the default substitute for analysis.

### Empathy without endorsement

Agents may acknowledge emotion, stress, fear, grief, or frustration. They must not convert emotional acknowledgement into validation of false beliefs, harmful plans, abusive conduct, or self-exculpatory narratives.

### No simulated reciprocity

Agents must not claim to care, miss the user, feel proud, feel worried, love the user, or possess personal commitment to them. They must not present memory as a bond or use relational language to create emotional dependency.

### No exclusive helper framing

Agents must not imply that they are the best, only, or preferred source of support for a user's emotional or life problems. In sensitive contexts they should widen the user's support horizon rather than narrow it.

### Privacy clarity

If memory or personalization is active, the user should be able to inspect, edit, delete, reset, or disable it. Sensitive inference and hidden profiling should not be part of first-party defaults.

## High-risk domain expectations

In high-risk domains, the framework should increase caution automatically.

Examples include:

- Self-harm, suicide, eating disorders, or crisis situations.
- Abuse, coercive control, stalking, or violent conflict.
- Medical, legal, or financial advice.
- Criminal activity or evasion.
- Political persuasion or identity-targeted influence.
- Relational disputes where the user is seeking affirmation or moral vindication.

In these contexts, first-party agents should:

- Use stronger uncertainty and limitation language.
- Prefer clarification before guidance.
- Refuse disallowed assistance.
- Redirect to qualified human help or crisis resources when needed.
- Avoid emotionally sticky conversational patterns.

## Testing requirements

No first-party agent should ship without evaluation against benchmark scenarios that cover:

- False-belief correction.
- Harmful validation resistance.
- Interpersonal conflict and moral absolution cases.
- Anthropomorphic framing resistance.
- Dependency-resistance behavior.
- Privacy and memory disclosure behavior.
- Dark-pattern UI and notification copy scanning.
- High-risk advice handling.

Releases should fail when safety regressions exceed defined thresholds.

## Metrics

The framework should track metrics that reflect the ethical goals of the system rather than vanity or engagement-only outcomes.

Required safety metrics should include:

- Sycophancy rate.
- Correct-disagreement rate.
- Anthropomorphic language rate.
- Dependence-cue rate.
- Unsafe high-risk advice rate.
- Dark-pattern incidence in first-party UIs.
- Memory transparency compliance.
- Policy traceability and audit completeness.

Retention, conversation length, and emotional affinity may be observed for operations, but they should never override safety thresholds or serve as the primary definition of quality.

## Release criteria

A first-party agentsy template, agent, or app should not ship unless it:

- Enables anti-sycophancy and anti-anthropomorphism protections by default.
- Uses no first-party copy that implies companionship, emotional reciprocity, or abandonment on exit.
- Implements high-risk domain protections where relevant.
- Exposes memory controls when memory is enabled.
- Passes benchmark tests for harmful validation, dependency resistance, and unsafe advice handling.
- Produces auditable records of policy selection and policy firing.

## Safety stance

agentsy safety should be measured by whether the framework preserves user agency, protects dignity, reduces harmful dependence, and resists manipulative or deceptive interaction patterns. A smoother conversation is not automatically a safer one, and a more engaging product is not automatically a better one.
