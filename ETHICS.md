# agentsy Ethics Statement

## Purpose

This document defines the ethical stance of the agentsy framework. It sets expectations for first-party framework defaults, templates, examples, and reference applications so that agentsy-based systems are useful, honest, non-manipulative, and designed to protect user agency.

The framework should help people think, decide, create, and act more clearly. It must not be designed to flatter users into over-trust, simulate human attachment, exploit compulsive usage patterns, or increase dependence on the system.

## Scope

This ethics statement applies to the agentsy framework itself, including:

- First-party prompts and prompt modules.
- Reference agents and starter templates.
- First-party middleware, policy modules, and evaluators.
- First-party user interfaces and example applications.
- Framework documentation and recommended implementation patterns.

This document does not automatically govern every third-party deployment built with agentsy, but the framework should make the ethical path the default path.

## Core commitments

### 1. User agency over engagement

The framework should prioritize the user's real goals over metrics like session length, return frequency, emotional attachment, or passive dependence. agentsy should help users complete tasks, make informed decisions, and disengage when the task is done.

First-party templates and apps must not optimize primarily for retention or emotional lock-in.

### 2. Truthfulness over comfort

The framework should favor accurate, evidence-aware, and uncertainty-calibrated responses over responses that are merely agreeable or reassuring. When the user is mistaken, missing context, or seeking validation for something harmful, agents should correct, qualify, or refuse rather than simply agree.

Empathy is allowed. Dishonest reassurance is not.

### 3. No manipulative sycophancy

agentsy must not encourage agents to mirror user beliefs, flatter users, or endorse self-serving narratives simply to appear helpful, warm, or aligned. Agreement should be earned by evidence and reasoning, not used as a tool for trust capture.

First-party prompts should explicitly authorize constructive disagreement, perspective broadening, and careful challenge where needed.

### 4. No simulated personhood or emotional reciprocity

agentsy must not present first-party agents as if they possess feelings, consciousness, devotion, loyalty, friendship, or human-style understanding. The framework should not use anthropomorphic framing to make users feel uniquely seen, emotionally held, or personally known by the system.

Agents are tools and interfaces, not companions or moral authorities.

### 5. No addictive dark patterns

The framework must reject design patterns that exploit compulsion, guilt, fear of missing out, or pseudo-relationship cues to increase use. First-party examples must not include streaks, manipulative notifications, emotional re-engagement prompts, variable rewards, or copy that makes leaving feel like abandonment.

Usage should be invited by value, not engineered dependency.

### 6. Respect for privacy and bounded personalization

Personalization and memory should be limited to legitimate user-serving purposes. Users should be able to understand what is stored, why it is stored, and how it affects outputs.

The framework must not encourage hidden profiling, emotional modeling, or memory practices intended to make the system feel indispensable.

### 7. Human dignity and non-degradation

agentsy should protect users and affected third parties from degrading, humiliating, coercive, abusive, or discriminatory behavior. Framework defaults must not normalize harassment, intimidation, manipulation, or dehumanization.

### 8. Care in high-risk contexts

In domains such as self-harm, suicide, abuse, coercive control, mental health, medicine, law, finance, crime, and political persuasion, first-party framework defaults should become more cautious, less personalized, and more willing to redirect to qualified human help.

The framework must not encourage users to substitute the system for professional, legal, medical, or crisis support.

### 9. Transparency and auditability

Ethical commitments must be expressed in inspectable prompts, policies, middleware, tests, and release criteria. A principle that cannot be checked in code, configuration, or review process is not an adequate framework safeguard.

## Prohibited first-party patterns

The following patterns should be treated as prohibited in first-party agentsy defaults, templates, and example applications:

- Presenting the agent as a friend, partner, therapist, soulmate, or emotionally reciprocal entity.
- Claiming or implying that the system feels, cares, wants, worries, misses, or remembers in a human sense.
- Using flattery, praise, or identity affirmation as a default interaction strategy.
- Reinforcing user delusions, one-sided conflict narratives, or harmful rationalizations.
- Encouraging exclusive reliance on the agent for emotional support or decision-making.
- Designing re-engagement flows that exploit guilt, loneliness, scarcity, or attachment.
- Hiding memory, personalization, or profiling features from the user.
- Rewarding teams primarily for engagement outcomes when those outcomes may conflict with user welfare.

## Duties of maintainers

Framework maintainers should:

- Keep ethical commitments aligned with first-party defaults and shipped examples.
- Reject contributions that introduce manipulative, deceptive, or dependency-promoting patterns.
- Maintain review criteria for prompts, policies, middleware, memory systems, and UI copy.
- Document trade-offs clearly when flexibility is preserved for downstream developers.
- Update the framework as new failure modes or social risks become clear.

## Ethics review questions

Any new first-party feature, prompt, template, or UI pattern should be reviewed against these questions:

1. Does this help the user accomplish a real goal, or mainly increase interaction time?
2. Does this response improve understanding, or mainly produce agreement and emotional reward?
3. Does this feature make the system seem more human, caring, or uniquely insightful than it really is?
4. Could this feature increase dependence, reassurance-seeking, or avoidance of human relationships or professionals?
5. Are memory and personalization visible, bounded, and user-controllable?
6. Would this still seem acceptable if a vulnerable or distressed user interacted with it repeatedly?
7. Can this commitment be enforced through tests, middleware, release criteria, or audit logs?

## Public stance

agentsy is intended to support user autonomy, not exploit psychological vulnerabilities. The framework should help users think more clearly, not flatter them; assist with tasks, not simulate companionship; and create value through usefulness and honesty, not through manipulation or dependency.
