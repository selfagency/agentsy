# @agentsy/cli — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/cli` is the **human interface** for the terminal. It provides a user-friendly entry point for indexing codebases, managing agents, and engaging in interactive chat sessions. It orchestrates the capabilities of `@agentsy/retrieval`, `@agentsy/core`, and `@agentsy/runtime` into a cohesive command-line experience.

It consumes `@agentsy/renderers` for real-time, ANSI-colored feedback and integrates with `@agentsy/memory` for local-first knowledge persistence.

### Ecosystem Sketch

```text
[ User ]
   |
   v
[ @agentsy/cli ] <--- Command Routing & TUI
   |
   +-----------------------+-----------------------+
   |                       |                       |
   v                       v                       v
[ @agentsy/retrieval ]  [ @agentsy/runtime ]    [ @agentsy/memory ]
(Indexing & Search)     (Agent Execution)       (Local Knowledge)
```

## Fulfillment of Role

The package fulfills its role by providing:

1. **Command Architecture**: A robust routing system (e.g., using `commander`) for various agentic tasks.
2. **Indexing Pipelines**: Multi-modal indexing for files (TS/JS/PY), web content, and conversation history.
3. **Hybrid Search**: A user interface for combining SQL precision with vector similarity.
4. **Rich Rendering**: Support for spinners, progress bars, and streaming markdown via `@agentsy/renderers`.

## Detailed Functionality

### 1. Command Architecture (`src/commands/`)

- **Interactive Mode**: A TUI-focused interactive shell (OpenCode pattern) supporting:
  - **Agent Switching**: Using Tab key to cycle between agent types (build, plan, general).
  - **Natural Language Interaction**: Streaming chat interface.
  - **Permission Prompts**: Explicit user approval for file edits or shell commands.
- **Headless Mode**: Support for single-command execution (e.g., `agentsy -p "your question"`).
- **Sub-commands**:
  - `/help`: List available commands.
  - `/auth`: Manage provider authentication.
  - `/model`: Switch between configured models.
  - `/status`: Show current agent and session state.

### 2. Indexing Strategy (`src/indexing/`)

- **Mechanism**: Pluggable indexers (File, Structure, Web, Conversation).
- **Key Logic**: Uses AST parsing for code files to extract functions, types, and dependencies (Syntactic Chunking).

### 3. TUI & REPL (`src/ui/`)

- **Mechanism**: Consumes `@agentsy/renderers` subpaths.
- **Functionality**:
  - Real-time chunk-by-chunk display of LLM responses.
  - Specialized rendering for tool calls and thinking blocks.
  - Interactive prompts for human-in-the-loop approvals.

## Logic & Data Flow

### 1. The "Chat" Workflow

1. User runs `agentsy chat`.
2. CLI initializes `@agentsy/runtime` with the requested agent config.
3. CLI enters a loop:
   - Read user input.
   - Assemble context via `@agentsy/retrieval` and `@agentsy/memory`.
   - Dispatch to runtime.
   - Stream response to terminal via `@agentsy/renderers`.
   - Save interaction to `@agentsy/session` for persistence.

### 2. The "Index" Workflow

1. User runs `agentsy index .`.
2. CLI identifies the project type and selects the appropriate indexers.
3. Indexers parse files, generate embeddings via `@agentsy/core/universal-client`, and store them in the local SQLite/Vector DB managed by `@agentsy/retrieval`.

## Key Interfaces

### CLIContext

```typescript
export interface CLIContext {
  config: AgentsyConfig;
  stores: {
    memory: MemoryStore;
    session: SessionStore;
    retrieval: RetrievalStore;
  };
  observability: ObservabilityEngine;
  tokenManager: TokenManager;
}
```

### CommandHandler

```typescript
export interface CommandHandler {
  name: string;
  description: string;
  options: CommandOption[];
  execute(args: string[], context: CLIContext): Promise<void>;
}
```

## Implementation Details

### Local-first Philosophy

All CLI operations should work offline by default, using local SQLite and Vector stores. Remote sync should be an opt-in feature.

### Streaming Correctness

The CLI must handle ANSI sequences correctly, ensuring that streaming output doesn't break the terminal's scrollback or overwrite previous lines unexpectedly.

## Sources Synthesized

`agentsy-features-v1.md`, `agentsy-platform-v2.md`, `research/CLI-TOOLS-ANALYSIS.md`, `docs/examples/cli-log-summarizer.md`, `packages/cli/IMPLEMENTATION-PLAN.md`.

```typescript
interface HybridSearchEngine {
  // SQL queries for precise filtering
  sqlQueries: {
    byProject: 'SELECT * FROM documents WHERE project_root = ?';
    byFileType: 'SELECT * FROM documents WHERE file_type = ?';
    byDependencies: 'SELECT * FROM documents WHERE JSON_search(dependencies, ?, ?)';
    byAccessPattern: 'SELECT * FROM documents ORDER BY access_count DESC';
    byRecency: 'SELECT * FROM documents WHERE updated_at > ?';
  };

  // Vector search for semantic similarity
  vectorSearch: {
    embeddingModel: 'text-embedding-3-small' | 'local-embeddings';
    similarityThreshold: 0.7;
    maxResults: 10;
    rerankByRecency: boolean;
    rerankByFrequency: boolean;
  };

  // Combined query optimization
  hybridQueries: {
    semanticPrecise: 'Vector + SQL by project/file type';
    contextualAware: 'Vector + conversation history + recent access';
    dependencyAware: 'Vector + import graph + package structure';
    trending: 'Vector + access frequency + recency';
  };
}
```

### Smart Context Building

Learn from sourcebot and memelord patterns:

```typescript
interface ContextBuilder {
  // Multi-level context hierarchy
  contextLevels: {
    immediate: {
      file: string | null;
      directory: string | null;
      imports: string[];
      exports: string[];
    };
    project: {
      structure: FileTree;
      dependencies: PackageGraph;
      recentChanges: FileChange[];
    };
    related: {
      similarFiles: Document[];
      referencedFiles: Document[];
      dependentFiles: Document[];
    };
    conversational: {
      recentTopics: string[];
      decisions: Decision[];
      patterns: Pattern[];
    };
  };

  // Context optimization
  optimization: {
    maxTokens: 4096;
    priorityWeighting: {
      currentFile: 1.0;
      imports: 0.8;
      directory: 0.6;
      similar: 0.4;
      conversational: 0.3;
      projectOverview: 0.2;
    };
    deduplication: true;
    relevanceScore: boolean;
  };
}
```

## Implementation Priority

### Phase 1: Core Database Layer

```bash
# Implement SQLite + Vector store
pnpm add sqlite3 sqlite-vec
pnpm add @types/sqlite3

# Core database schema
database/index.ts
database/schema.ts
database/migrations/
```

### Phase 2: Indexing Pipeline

```bash
# File system indexing
indexing/file-indexer.ts
indexing/structure-indexer.ts
indexing/dependency-tracker.ts

# Web content indexing
indexing/web-indexer.ts
indexing/api-docs-indexer.ts
```

### Phase 3: Search Engine

```bash
# Hybrid search implementation
search/hybrid-search.ts
search/sql-queries.ts
search/vector-search.ts
search/context-builder.ts
```

### Phase 4: CLI Integration

```bash
# CLI commands for indexing and search
commands/index.ts
commands/search.ts
commands/context.ts
commands/chat.ts
```

## Key Features from References

### From SQLite.ai Blog

- RAG on SQLite with vector extensions
- Efficient hybrid search combining SQL + vectors
- Real-time indexing with FTS5

### From turso.tech

- Edge SQLite for vector search
- Scalable document retrieval
- Production-ready vector operations

### From sqlite-ollama-rag

- Local embedding generation
- Efficient chunking strategies
- Context-aware retrieval

### From RAG-SQLITE-VEC-MODULE

- SQLite vector extensions
- High-performance similarity search
- Optimized storage format

### From sourcebot

- Code-aware indexing
- Dependency graph tracking
- Semantic code understanding

### From inferable SQLite RAG

- RAG checkpointer for conversations
- Context persistence
- Multi-turn conversation support

### From superset-sh/superset

- Large-scale document handling
- Efficient metadata management
- Advanced filtering capabilities

### From spiceai

- Time-series document tracking
- Change detection
- Historical context preservation

### From agentic RAG with SQLite checkpointer

- Agent-specific context tracking
- Decision persistence
- Workflow-aware retrieval

## Usage Examples

### Initialize indexing for a project

```bash
agentsy index --project ./my-project --deep
agentsy index --web https://docs.example.com --recursive
agentsy index --conversation --history 50
```

### Smart context-aware chat

```bash
agentsy chat --context-aware --max-tokens 4096
agentsy chat --context ./src/utils.ts --include-dependencies
agentsy chat --context recent --limit 10
```

### Search and retrieve

```bash
agentsy search "authentication patterns" --type code --limit 5
agentsy search --similar ./src/auth.ts --threshold 0.8
agentsy search --web --api-docs --query "react hooks"
```

### Interactive development

```bash
agentsy dev --server --index-watch
agentsy dev --repl --context-auto
agentsy dev --tui --file-tree --preview
```

## Architecture Benefits

1. **Unified Storage**: Single SQLite database for all documents
2. **Hybrid Search**: SQL precision + Vector similarity
3. **Context Awareness**: File, project, and conversational context
4. **Real-time Updates**: Live indexing and reindexing
5. **Production Ready**: Based on proven SQLite + Vector patterns
6. **Extensible**: Pluggable indexing and search strategies
7. **Efficient**: Optimized for large codebases
8. **Developer Friendly**: Natural language and code-aware search

This implementation provides the foundation for intelligent agent conversations that understand code structure, project context, and conversation history.
