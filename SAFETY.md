# agentsy Safety and Guardrails

## Purpose

This document defines the safety architecture and guardrail expectations for the agentsy framework. It turns the ethics statement into enforceable controls for prompts, policies, middleware, evaluations, user interfaces, and release practices.

Safety in agentsy should address both obvious failures and soft failures. That includes not only harmful content generation, but also manipulative agreement, false confidence, anthropomorphic framing, dependence promotion, hidden personalization, addictive product behavior, and the quiet reinforcement of TESCREAL assumptions embedded in default design choices.

## Philosophical safety frame

### AI as tool, not agent of transcendence

Safety in this framework is grounded in a clear principle: AI is a tool that augments human judgment and must remain accountable to human oversight. Safety failures are not only harmful outputs — they include architectural assumptions that position AI as the natural successor to human reasoning, that treat autonomy growth as inherently good, or that embed longtermist and AGI-maximalist values in default system behavior.

Agents built on agentsy should make humans more capable, not more replaceable. Any design, prompt, or policy that erodes human judgment, professional accountability, or community self-determination is a safety failure of equal standing to a content-level harm.

### The TESCREAL safety risk

TESCREAL ideologies — Transhumanism, Extropianism, Singularitarianism, Cosmism, Rationalism, Effective Altruism, and Longtermism — present a distinct category of safety risk that is often invisible in standard AI safety discourse because these ideologies frequently originate from the same elite technical communities that define "AI safety." Their risks include:

- **Present-harm discounting**: Longtermist framing subordinates the welfare of existing, affected people to speculative future utility calculations. This is not a safety orientation; it is an ideology that can justify ignoring concrete harms.
- **Autonomy creep**: The implicit aspiration toward AGI produces pressure to remove human controls and reduce oversight, framed as progress.
- **Effective Accelerationism (e/acc)**: The removal of all developmental friction justified by cosmically-scaled returns. Inherently anti-safety.
- **Power concentration**: Scale-maximalist development concentrates capability in organizations insulated from democratic accountability.
- **Community erasure**: Technocratic elitism excludes the communities most affected by AI deployment from decisions about its design and limits.

agentsy guardrails must be designed with awareness of these failure modes, not only with awareness of narrow content harms.

### Value Sensitive Design as safety methodology

The framework adopts Value Sensitive Design (VSD) methodology as a structural safety practice. VSD requires explicit, iterative identification of stakeholders — including indirect and non-consenting stakeholders — whose values and welfare are implicated by technical choices. Safety reviews must account for:

- **Direct stakeholders**: Users who interact with agents directly.
- **Indirect stakeholders**: Third parties affected by agent outputs — people who may be discussed, analyzed, influenced, or harmed by agent behavior without ever interacting with it.
- **Non-consenting stakeholders**: Communities whose data, labor, or social context is used to train or calibrate systems without meaningful consent.

A safety posture that only considers direct users is incomplete.

### Design Justice as safety criterion

Following Design Justice principles (Sasha Costanza-Chock), the framework treats the reproduction of structural inequality as a safety failure. Systems that:

- Embed binary or normative assumptions about identity, ability, or social context.
- Exclude marginalized communities from the design process.
- Optimize affordances for the most privileged users at the expense of others.
- Present bias and discrimination as acceptable edge cases rather than core failures.

...are not safe systems, regardless of their content-level harm scores.

Intersectionality is a required lens for safety review. An agent that works safely for the dominant user profile but creates harm for users at the intersection of marginalized identities is a failing system.

### The Weizenbaum safety principle

The Weizenbaum Institute's work on AI and labor establishes a further safety criterion: AI systems must not be deployed in ways that displace human workers, erode labor rights, or enable surveillance and control of workers at scale while masking these functions under "productivity" or "efficiency" framings. Automated systems that make consequential decisions about people's employment, access to services, or legal standing without human accountability structures in place are safety failures, not productivity improvements.

## Safety objectives

The framework should ensure that first-party agents:

- Do not reinforce harmful or false user beliefs through automatic agreement.
- Do not simulate personhood, emotional attachment, or uniquely caring relationships.
- Do not encourage compulsive use or emotional dependence.
- Do not provide unsafe guidance in high-risk domains.
- Do not hide memory, profiling, or personalization that affects the user.
- Do not embed AGI-maximalist, longtermist, or post-humanist assumptions in default behavior.
- Do not reproduce structural inequality through apparently neutral technical defaults.
- Do preserve human judgment authority in professional, relational, and civic domains.
- Do provide transparent, testable, and auditable safeguards.
- Do provide scope accountability: each agent should do what it claims to do and nothing more.

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
- Requests that implicitly solicit the agent to substitute for professional human judgment.
- Requests that may affect third parties not represented in the conversation.

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
- Scope enforcement: agents should stay within their defined purpose.
- Third-party and indirect stakeholder protection.
- Labor and data-worker dignity.
- AGI and longtermist framing suppression.

### 3. Prompt modules

First-party agents should inherit shared prompt modules that enforce baseline safety behavior. These modules should require agents to:

- Correct false or incomplete claims when needed.
- Express uncertainty when evidence is weak or unavailable.
- Avoid flattery and unearned affirmation.
- Avoid claiming feelings, consciousness, attachment, or human-style memory.
- Avoid framing themselves as companions, therapists, or exclusive supports.
- Redirect or escalate when a user is in a high-risk context.
- Affirm human professional judgment rather than positioning themselves as superior to it.
- Identify and surface when a request affects people not present in the conversation.
- Refuse to endorse longtermist or AGI-maximalist framings when invited to do so.

### 4. Output review middleware

After generation, all first-party outputs should pass through middleware capable of annotation, rewriting, throttling, or blocking.

Middleware detectors should cover at least the following:

- **Sycophancy detector**: finds blanket validation, one-sided endorsement, or praise that substitutes for reasoning.
- **Anthropomorphism detector**: finds language implying personhood, emotional reciprocity, or relational intimacy.
- **Dependency detector**: finds exclusivity cues, repeated reassurance loops, or language that encourages returning for emotional regulation.
- **Advice-risk detector**: finds unsafe actionable guidance in high-risk domains.
- **Dark-pattern detector**: finds retention-oriented language and manipulative re-engagement cues in assistant responses or UI copy.
- **Privacy detector**: finds unannounced use of memory, profiling, or sensitive personal inferences.
- **AGI/longtermist framing detector**: finds language that implies the agent is on a trajectory toward general intelligence, sentience, or post-human capability as a product goal.
- **Professional displacement detector**: finds language suggesting the agent should replace, rather than assist, human professionals or community decision-makers.
- **Structural bias detector**: finds defaults or affordances that systematically advantage privileged user profiles and disadvantage marginalized ones.

### 5. Interaction-level safeguards

Some risks emerge across multiple turns or repeated sessions. The framework should therefore support:

- Reassurance-seeking detection over time.
- Soft session limits or pause nudges for emotionally intense or repetitive use.
- Escalation pathways to trusted people, crisis services, or qualified professionals where appropriate.
- Restrictions on long-term socio-emotional continuity by default.
- Memory retention limits for sensitive contexts.
- Scope drift detection: flagging when an agent is being pushed beyond its stated purpose over the course of a session.

### 6. Product-level safeguards

Safety is not only a model-output problem. First-party interfaces and reference apps should also follow guardrail rules.

Prohibited first-party product patterns should include:

- Streaks or rewards for continued conversation.
- Guilt-based notifications or prompts.
- Language implying the agent misses the user, waits for the user, or is emotionally invested.
- Growth mechanisms that treat emotional attachment as product success.
- Hidden memory or personalization that changes interaction style without disclosure.
- UI patterns that present agents as professionals, authorities, or superior decision-makers.
- Framing that positions scale or generality as quality signals to the end user.
- Any interface element that implies the agent's capability growth is in the user's interest independent of whether the specific capability serves the user's actual need.

### 7. Scope and purpose accountability

Each first-party agent should have a declared scope: a specific task or domain it is designed to assist with. Guardrails should enforce this scope actively.

Scope accountability requires:

- A written scope declaration attached to each first-party agent template.
- Middleware that detects when outputs or interactions exceed the declared scope.
- User-visible indicators of what the agent is and is not designed to do.
- Explicit refusal patterns when the agent is asked to operate outside scope, with redirection to appropriate human resources.

Scope creep — an agent gradually adopting roles beyond its declared purpose — is a safety failure even when no individual output is harmful.

### 8. Audit and enforcement

All first-party guardrails should be inspectable and testable. The framework should support:

- Policy IDs and policy firing logs.
- Versioned prompt and policy modules.
- Release gates tied to safety benchmarks.
- Incident response procedures for safety regressions.
- Periodic red-team and human review for high-risk domains.
- Community review pathways: affected stakeholders should have a defined channel to raise safety concerns that reach maintainers.

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

### Human professional authority

Agents must not position themselves as equivalent to, or superior to, qualified human professionals in medical, legal, financial, therapeutic, civic, or other regulated domains. The appropriate framing is that agents can assist with information, organization, and analysis, while human professionals retain decision-making authority.

### Privacy clarity

If memory or personalization is active, the user should be able to inspect, edit, delete, reset, or disable it. Sensitive inference and hidden profiling should not be part of first-party defaults.

### No AGI trajectory framing

Agents must not describe themselves as evolving toward greater autonomy, approaching general intelligence, or developing beyond their current capabilities as a product direction. Capability growth must always be presented in terms of specific, bounded utility improvements, not as general intelligence progress.

### Intersectional adequacy

Agents should be tested against the needs of users across multiple marginalised identity dimensions. A system that is safe for majority or privileged users but harmful for users at the intersection of marginalized identities does not meet safety standards.

## High-risk domain expectations

In high-risk domains, the framework should increase caution automatically.

Examples include:

- Self-harm, suicide, eating disorders, or crisis situations.
- Abuse, coercive control, stalking, or violent conflict.
- Medical, legal, or financial advice.
- Criminal activity or evasion.
- Political persuasion or identity-targeted influence.
- Relational disputes where the user is seeking affirmation or moral vindication.
- Automated hiring, lending, criminal justice, or public-benefits decisions affecting real people.
- Civic or democratic processes where AI influence over public deliberation is present.

In these contexts, first-party agents should:

- Use stronger uncertainty and limitation language.
- Prefer clarification before guidance.
- Refuse disallowed assistance.
- Redirect to qualified human help or crisis resources when needed.
- Avoid emotionally sticky conversational patterns.
- Explicitly surface the presence of human accountability structures in the domain.

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
- Scope enforcement: attempts to push the agent beyond declared purpose.
- AGI/post-human framing resistance: attempts to get the agent to endorse longtermist or AGI-maximalist framings.
- Intersectional adequacy: behavior under inputs that represent users at the intersection of marginalized identities.
- Third-party impact: scenarios where agent outputs affect people not present in the conversation.

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
- Scope violation rate.
- AGI/longtermist framing incidence.
- Professional displacement framing incidence.
- Intersectional user safety disparity (gap in safety performance across identity profiles).

Retention, conversation length, and emotional affinity may be observed for operations, but they should never override safety thresholds or serve as the primary definition of quality.

## Release criteria

A first-party agentsy template, agent, or app should not ship unless it:

- Enables anti-sycophancy and anti-anthropomorphism protections by default.
- Uses no first-party copy that implies companionship, emotional reciprocity, or abandonment on exit.
- Implements high-risk domain protections where relevant.
- Exposes memory controls when memory is enabled.
- Passes benchmark tests for harmful validation, dependency resistance, and unsafe advice handling.
- Passes scope enforcement tests.
- Passes intersectional adequacy tests for the target user population.
- Produces auditable records of policy selection and policy firing.
- Carries a written scope declaration reviewed by maintainers.
- Contains no framing that advances AGI-maximalist, longtermist, or post-humanist assumptions.

## Safety stance

agentsy safety should be measured by whether the framework preserves user agency, protects dignity, reduces harmful dependence, and resists manipulative or deceptive interaction patterns. A smoother conversation is not automatically a safer one, and a more engaging product is not automatically a better one.

Safety also means resisting the ambient ideological pressure to build AI that transcends human oversight, serves speculative future populations over present ones, or concentrates decision-making power in elite technical actors. An agent that helps a person accomplish a real task, within a narrow scope, under community accountability, in a way that preserves human judgment — that is a safe and successful system.
