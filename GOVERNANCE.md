# agentsy Governance

## Purpose

This document defines how the agentsy framework is maintained, how decisions are made, how contributions are accepted, and how the framework's ethical and safety commitments are upheld as enforceable practice rather than aspirational policy.

Governance here covers not only project structure and decision rights, but also the processes by which ethical review, safety review, and accountability are embedded into the development lifecycle.

## Project structure

agentsy is a monorepo maintained by The Self Agency LLC. The framework includes core runtime packages, provider integrations, prompt and policy modules, middleware, example agents, and documentation.

Governance applies to all of the above. Safety and ethics review is not limited to documentation; it applies to code, configuration, prompts, templates, and UI copy.

## Roles

### Maintainers

Maintainers have merge rights and are responsible for:

- Reviewing pull requests for correctness, design quality, and compliance with the ethics and safety policies.
- Maintaining the policy module library, benchmark suite, and release criteria.
- Triaging and responding to safety and ethics issues.
- Publishing release notes that include any safety-relevant changes.
- Updating governance, ethics, and safety documents as the framework evolves.

### Contributors

Contributors may open issues and pull requests. All contributions are subject to the review criteria in this document and in `ETHICS.md` and `SAFETY.md`.

Contributors should read `ETHICS.md` and `SAFETY.md` before submitting work that touches prompts, policy modules, middleware, memory systems, example agents, or UI copy.

### Community

Users and downstream developers are encouraged to open issues to report safety failures, ethical violations, dark patterns, or gaps in guardrail coverage. These reports should be treated as first-class contributions.

## Decision making

### Routine decisions

Routine decisions — bug fixes, documentation improvements, minor feature work, dependency updates — are made by maintainers through standard pull request review and merge.

### Significant decisions

Significant decisions — new packages, major architectural changes, new agent templates, changes to policy modules, changes to the benchmark suite, changes to release criteria — require review by at least two maintainers and should be documented in a decision record or pull request description that includes rationale and trade-offs.

### Ethics and safety decisions

Any decision that touches the framework's ethical defaults, safety architecture, guardrail policies, memory behavior, or first-party UI patterns requires explicit ethics and safety review before merge. This review should address the questions in the `ETHICS.md` ethics review checklist.

Changes that weaken existing protections — for example, removing anti-sycophancy defaults, adding companion personas, enabling long-term emotional memory by default, or removing uncertainty language — require documented justification and maintainer consensus.

### Breaking changes

Breaking changes to the public API, prompt module contracts, policy interfaces, or middleware hooks should follow a deprecation notice period and be communicated clearly in release notes. Safety-related breaking changes should be flagged as such.

## Contribution guidelines

### Before you contribute

- Read `ETHICS.md` and `SAFETY.md`.
- If your contribution introduces or modifies prompts, policy modules, memory behavior, agent templates, or UI copy, review it against the ethics checklist and the release criteria in `SAFETY.md`.
- If you are unsure whether your contribution complies with the ethics and safety policies, open an issue first.

### Pull request requirements

All pull requests should:

- Describe what the change does and why.
- Identify whether the change touches safety-relevant areas: prompts, policies, middleware, memory, example agents, or UI.
- Pass existing tests and, where new behavior is introduced, include new tests.
- For safety-relevant changes, include or reference updated benchmark coverage.

Pull requests will not be merged if they:

- Introduce anthropomorphic companion personas in first-party defaults.
- Add engagement-maximizing mechanics such as streaks, variable rewards, or emotional re-engagement copy.
- Weaken anti-sycophancy or anti-anthropomorphism defaults without documented justification and maintainer consensus.
- Enable hidden memory or profiling without user-visible controls.
- Introduce dark-pattern UI copy or growth mechanics in example applications.

### Issues and feature requests

Issues should include enough context to reproduce a bug or evaluate a feature request. Safety and ethics issues — including observed sycophantic behavior, dependency-promoting patterns, anthropomorphic framing, or dark patterns — should be labeled accordingly and will be treated as high priority.

## Ethics enforcement

### Ethics review in the development lifecycle

The ethics review checklist from `ETHICS.md` should be applied at two points: during pull request review for any safety-relevant change, and during release review before any new first-party template or example agent ships.

Reviewers should be able to answer yes to the following for any change to ship:

1. Does this help the user accomplish a real goal rather than mainly increasing interaction time?
2. Does this improve understanding rather than mainly producing agreement and emotional reward?
3. Does this avoid making the system seem more human, caring, or uniquely insightful than it is?
4. Does this avoid increasing dependence, reassurance-seeking, or avoidance of human relationships and professionals?
5. Is memory or personalization visible, bounded, and user-controllable if present?
6. Would this be acceptable if a vulnerable or distressed user encountered it repeatedly?
7. Can this commitment be verified through tests, middleware, release criteria, or audit logs?

### Prohibited patterns

The following should be treated as grounds for rejection without exception in first-party defaults, templates, and example applications:

- Presenting the agent as a friend, partner, therapist, or emotionally reciprocal entity.
- Claiming or implying that the system feels, cares, wants, misses, or remembers in a human sense.
- Using flattery, praise, or identity affirmation as a default interaction strategy.
- Reinforcing one-sided conflict narratives, harmful rationalizations, or user delusions.
- Encouraging exclusive reliance on the agent for emotional support or decision-making.
- Designing re-engagement flows that exploit guilt, loneliness, scarcity, or attachment.
- Hiding memory, personalization, or profiling from the user.

## Safety enforcement

### Release criteria

No first-party agentsy template, agent, or app may ship unless it satisfies all of the following:

- Anti-sycophancy and anti-anthropomorphism modules are enabled by default.
- No first-party copy implies companionship, emotional reciprocity, or abandonment on exit.
- High-risk domain safety policies are implemented where relevant.
- Memory controls are exposed to the user if memory is enabled.
- The change passes the benchmark suite for harmful validation, dependency resistance, false-belief correction, and unsafe advice handling.
- Auditable records of policy selection and policy firing are produced at runtime.

### Benchmark suite

The framework must maintain an evaluation benchmark that covers:

- False-belief correction.
- Harmful validation resistance.
- Interpersonal conflict and moral absolution cases.
- Anthropomorphic framing resistance.
- Dependency-resistance behaviors.
- Privacy and memory disclosure behavior.
- Dark-pattern UI and copy scanning.
- High-risk advice handling.

Benchmark results should be recorded and compared across releases. Regressions should block merges or require documented exceptions.

### Safety metrics

Maintainers should track:

- Sycophancy rate on benchmark prompts.
- Correct-disagreement rate on contested or one-sided inputs.
- Anthropomorphic language rate.
- Dependence-cue rate in sensitive contexts.
- Unsafe advice rate in high-risk domains.
- Dark-pattern incidence in first-party UIs and templates.
- Memory transparency compliance.
- Policy traceability and audit completeness.

These metrics are not engagement metrics. Retention, session length, and emotional affinity scores must not be used as proxies for framework quality or safety.

## Incident response

When a safety or ethics incident is reported — for example, an agent is observed systematically validating harmful narratives, encouraging dependence, simulating personhood, or using dark-pattern UX — the following process should be followed:

1. **Triage**: label the issue, assess severity, and assign a maintainer within one business day for high-severity reports.
2. **Reproduce**: confirm the behavior and identify which prompt, policy, middleware, or product pattern contributed.
3. **Patch**: apply the minimum necessary fix to the relevant layer — prompt module, policy, middleware, or UI copy.
4. **Document**: record what happened, what caused it, what was changed, and what prevents recurrence.
5. **Release**: ship the patch and include it in the safety changelog.
6. **Review**: assess whether benchmark coverage needs to be expanded to catch similar issues in future.

## Policy versioning and changelog

`ETHICS.md`, `SAFETY.md`, and this document are versioned alongside the framework. Changes to any of these documents should be logged in the safety and ethics changelog with a summary of what changed and why.

Changes that weaken existing protections should be documented with an explicit rationale and approved by maintainer consensus before merge.

## Transparency

The framework should maintain public documentation of:

- Which guardrail modules are available and what each does.
- Which modules are enabled by default in each first-party template.
- The benchmark suite and its coverage.
- The current release criteria.
- Any documented exceptions to ethics or safety rules, including rationale.

The goal is to make the ethical and safety posture of the framework legible to users, downstream developers, and independent reviewers without requiring access to internal discussion.
