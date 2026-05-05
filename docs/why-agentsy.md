# Why Agentsy

Agentsy exists so teams do not have to keep rebuilding the same LLM plumbing from scratch every quarter and then pretending it was a strategic decision.

## The problem it solves

Modern LLM features usually need the same set of hard, boring, failure-prone building blocks:

- streaming provider response parsing
- normalization across incompatible provider payloads
- structured-output parsing and repair
- tool-call accumulation across partial chunks
- renderer and UI integration surfaces
- state management around multi-step loops

Many libraries solve one slice. Most applications need several slices composed together.

## The Agentsy approach

Agentsy organizes those concerns into focused packages that can be adopted independently or composed into a larger stack.

At a high level, the ecosystem looks like this:

1. **Normalize** provider-specific payloads into a shared stream vocabulary.
2. **Process** the stream into stable events and transforms.
3. **Extract and validate** tool calls, structured data, and reasoning tags.
4. **Project** the stream into renderers, state stores, or product-specific integrations.
5. **Loop** on top of the pipeline when you need agent behavior.

## Why this stack is especially useful for headless Node.js workflows

One of the easiest traps in AI tooling is assuming every useful system eventually turns into a chat UI.

That is not how a lot of serious agentic work actually runs.

Many high-value workflows live perfectly well in **Node.js-compatible runtimes without any frontend at all**:

- background workers
- scheduled jobs
- repository automation
- CI/CD agents
- coding agents
- operator tooling
- internal automation services
- connector-driven bots and message processors

For those environments, the hard part is usually not drawing the chat bubble. It is building a dependable runtime around streaming, tool use, structured output, retries, recovery, approvals, and context handling.

Agentsy is intentionally shaped for that kind of system. The package boundaries make it practical to build agentic workflows that:

- run in Node.js-compatible environments
- stream and process model output incrementally
- operate entirely headless
- add UI, TUI, or editor integrations only when they are actually needed

## Already proving itself in real integrations

This stack is not only for future runtime plans. It is already being used in three VS Code extensions that provide third-party model support inside GitHub Copilot Chat:

- [Opilot](https://marketplace.visualstudio.com/items?itemName=selfagency.opilot) — Ollama models in Copilot Chat with tool support, vision support, streaming, and local-model workflows
- [Z.ai for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.z-models-vscode) — Z.ai coding models in Copilot Chat with tool calling, streaming, and MCP-backed capabilities
- [Mistral for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.mistral-models-vscode) — Mistral AI models in Copilot Chat with tool calling, streaming, and vision support

That gives Agentsy something useful beyond architecture intent: it is already being exercised in production-like editor integrations where provider normalization, streaming, tool handling, protocol bridges, and runtime ergonomics all matter.

## Why package boundaries matter here

Agentsy is intentionally not a single monolith anymore.

That gives teams a few advantages:

- adopt only the layers you need
- test lower-level parsing independently from runtime behavior
- keep VS Code and product-specific code out of foundation packages
- evolve roadmap concepts without pretending they already belong in every runtime

## Design principles

- **Composable over monolithic** — package boundaries mirror real concerns.
- **Strict TypeScript contracts** — model output is treated as untrusted input.
- **Streaming-first** — chunk boundaries, malformed partials, and recovery paths are first-class concerns.
- **Integration-aware** — UI, renderer, and editor surfaces are documented as consumers of the processing stack, not magical exceptions.
- **Open-standards aligned** — where real standards or credible emerging standards exist, Agentsy should meet developers there instead of inventing captive formats for its own sake.
- **Honest roadmap language** — planned packages stay labeled planned until they exist.

## Why open standards matter here

The AI tooling ecosystem is still young, messy, and full of overlapping claims. But where actual standards or serious standardization efforts do exist — things like **MCP**, **AG-UI**, and **skills-style interoperability** — Agentsy wants to align with them.

That means the goal is not to trap developers inside a proprietary ecosystem hatched inside and maintained by a single corporate entity.

The goal is an **open stack** for people building agentic tools of many kinds:

- headless Node.js workflows
- coding agents
- editor integrations
- operator tooling
- CLI applications
- connector-driven bots
- future app and UI surfaces that sit on top of the same runtime

Practically, that means:

- using open or emerging interoperability layers when they are credible and useful
- keeping package boundaries explicit so capabilities can be adopted independently
- avoiding product design that requires one hosted platform or one vendor-controlled runtime to be useful
- treating standards compatibility as part of the product direction, not as afterthought marketing garnish

Not every "standard" in AI is actually mature yet. Some are still more like active proposals than settled infrastructure. But even there, the bias should be toward **interoperability and portability**, not lock-in.

## Feature matrix

Legend:

- ✅ = available in current docs / current packages
- ⏳ = explicitly planned in the Agentsy roadmap
- ❌ = not offered, or not the product direction being pursued

| Capability                                                             | Agentsy | AI SDK | TanStack AI | Why it matters                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ------- | ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-provider model abstraction                                       | ✅      | ✅     | ✅          | All three platforms smooth over provider-specific APIs.                                                                                                                                  |
| Standalone normalization layer                                         | ✅      | ❌     | ❌          | Agentsy exposes provider normalization as its own installable concern instead of hiding it inside a larger runtime.                                                                      |
| Standalone stream-processing engine                                    | ✅      | ❌     | ❌          | Agentsy treats chunk processing, transforms, and event shaping as reusable infrastructure, not just a side effect of chat APIs.                                                          |
| Standalone structured-output parsing and repair utilities              | ✅      | ❌     | ❌          | Agentsy ships parsing/repair primitives as a dedicated layer; the others focus on generation APIs rather than repair-oriented infrastructure.                                            |
| Standalone thinking / reasoning extraction utilities                   | ✅      | ❌     | ❌          | Agentsy has a dedicated parsing surface for reasoning tags instead of only surfacing them through end-user chat abstractions.                                                            |
| Standalone tool-call parsing utilities                                 | ✅      | ❌     | ❌          | Agentsy exposes tool-call accumulation/parsing as reusable plumbing for custom runtimes and integrations.                                                                                |
| VS Code / editor integration package                                   | ✅      | ❌     | ❌          | Agentsy already ships an editor-focused integration layer instead of only app-facing SDKs.                                                                                               |
| AG-UI protocol bridge                                                  | ✅      | ❌     | ❌          | Agentsy includes a protocol-oriented bridge package that is separate from any one app framework.                                                                                         |
| Built-in agent loop                                                    | ✅      | ✅     | ✅          | All three support tool-using loops, though with different levels of control and surrounding abstractions.                                                                                |
| Headless Node.js workflow composition                                  | ✅      | ✅     | ✅          | All three can run server-side, but Agentsy is explicitly leaning into backend-only orchestration and runtime composition as a primary product story.                                     |
| Open-standards alignment (MCP / AG-UI / skills-style interoperability) | ⏳      | ✅     | ❌          | Agentsy already ships AG-UI support and is planning broader MCP and skills-oriented compatibility because the long-term goal is an open developer stack rather than a captive ecosystem. |
| First-party MCP client / orchestration layer                           | ⏳      | ✅     | ❌          | AI SDK already ships MCP client support; Agentsy plans broader MCP coordination as part of its runtime expansion.                                                                        |
| First-party memory and retrieval primitives                            | ⏳      | ❌     | ❌          | Agentsy plans native memory/retrieval layers; AI SDK currently documents memory patterns and third-party integrations rather than shipping an in-framework memory engine.                |
| Skills / slash commands / workflow productivity layer                  | ⏳      | ❌     | ❌          | Agentsy plans user-facing workflow layers as first-class packages rather than treating them as app-specific glue.                                                                        |
| Connectors for chat-platform surfaces                                  | ⏳      | ❌     | ❌          | Agentsy’s roadmap explicitly includes connector ecosystems beyond raw model invocation.                                                                                                  |
| Multi-agent / subagent orchestration                                   | ⏳      | ✅     | ❌          | AI SDK already documents subagents; Agentsy plans richer orchestration and session layers.                                                                                               |
| Agentic CLI app components                                             | ⏳      | ❌     | ❌          | Agentsy’s near-term roadmap expands toward runtime, skills, slash commands, MCP management, and connector pieces for agentic CLI and operator-style applications.                        |
| Framework-specific UI hooks                                            | ⏳      | ✅     | ✅          | AI SDK and TanStack AI already invest heavily in frontend hooks. Agentsy may grow hook layers later, but only after the runtime and CLI-oriented platform pieces land.                   |
| React Server Components / generative UI surface                        | ❌      | ✅     | ❌          | AI SDK explicitly supports generative UI and RSC-oriented primitives; Agentsy is not trying to be a React app framework.                                                                 |
| Tool approval UX as a first-class client flow                          | ⏳      | ❌     | ✅          | TanStack AI already ships explicit approval flows; Agentsy plans approval and policy layers as runtime infrastructure.                                                                   |
| Realtime voice / media-generation SDK surface                          | ❌      | ✅     | ✅          | AI SDK and TanStack AI expose media-generation surfaces, and TanStack AI goes further into realtime voice. Agentsy is not aiming to become a media SDK.                                  |
| Frontend devtools panel for AI interactions                            | ❌      | ❌     | ✅          | TanStack AI invests in a rich app-facing devtools experience; Agentsy is optimized around reusable infra packages instead.                                                               |
| Hosted gateway / platform-attached feature layer                       | ❌      | ✅     | ❌          | AI SDK offers an optional platform story around AI Gateway and related Vercel services. Agentsy is not trying to be a hosted vendor layer.                                               |

## What Agentsy already has that they do not

There are stronger ecosystems than Agentsy today for app-level AI features, but Agentsy already has a few differentiators that matter if you care about infrastructure boundaries:

- **Normalization as a first-class package boundary.** We separate provider normalization from stream processing instead of collapsing both into one giant runtime surface.
- **Parsing utilities you can adopt independently.** `@agentsy/thinking`, `@agentsy/tool-calls`, `@agentsy/structured`, `@agentsy/context`, `@agentsy/recovery`, and `@agentsy/xml-filter` are useful even when you do not want the rest of an agent framework.
- **Editor-facing integration as a real package.** `@agentsy/vscode` makes the ecosystem useful for toolsmithing and editor-native experiences, not only chat apps.
- **Protocol-aware projection layers.** `@agentsy/ag-ui` and `@agentsy/ui` make state and protocol projection explicit rather than burying them inside one client abstraction.
- **An explicitly open-stack direction.** The roadmap leans toward MCP, AG-UI, skills, connectors, and interoperable runtime pieces instead of inventing a sealed world where every useful workflow has to stay inside one vendor-shaped box.

## What they have that Agentsy is not prioritizing near-term

This part is important. If we try to win every feature war, we become mud.

Near-term, Agentsy is **not** trying to become:

- a framework-first chat-widget suite where hooks are the center of the product
- a generative-UI or React Server Components framework
- a hosted AI gateway, vendor routing layer, or observability platform
- a realtime voice and media-generation SDK
- a frontend devtools product

Those are real strengths for AI SDK and TanStack AI. They are just not the first product surface we are building.

What **is** prioritized first is the agentic runtime/CLI stack: session and runtime layers, memory and retrieval, skills, slash commands, MCP coordination, approval flows, and connector-style operator surfaces.

Frontend hooks may still happen later as downstream consumers of that runtime, but they are a longer-horizon layer rather than the immediate center of gravity.

Put differently: if your target is a **headless workflow running in Node.js**, that is not a second-class fallback here. That is one of the intended destinations.

Likewise, if your target is an **open, standards-aware developer stack**, that is also part of the intended destination.

## What is coming next for Agentsy

The roadmap points toward a different kind of expansion:

- agentic CLI and operator-oriented application components
- headless runtime building blocks for automation and background workflows
- memory and retrieval primitives
- MCP coordination and provider-management layers
- richer runtime/session orchestration
- skills, slash commands, and workflow productivity features
- connector ecosystems and more product-facing integrations

That roadmap keeps Agentsy focused on **composable agent infrastructure**, not on winning the race to become a full-stack AI app platform.

## Comparison notes

- AI SDK references above come from its current introduction, core, agents, memory, MCP, and UI docs.
- TanStack AI references above come from its current overview, tools, tool approval, thinking, realtime voice, devtools, and comparison docs.
- Agentsy statuses are based on current `packages/` code plus future-facing roadmap and planning documents. Anything marked ⏳ is roadmap, not current runtime reality.

## Who this ecosystem is for

- teams building internal LLM products that need reusable parsing and orchestration primitives
- teams building agentic workflows in Node.js-compatible runtimes without needing a frontend first
- extension authors building chat providers or editor-native AI experiences
- contributors who want a layered TypeScript foundation for future runtime, memory, MCP, or connector work

## Where to go next

- [Getting started](./getting-started.md)
- [Architecture overview](./architecture/index.md)
- [Package catalog](./packages.md)
- [Roadmap](./roadmap.md)
