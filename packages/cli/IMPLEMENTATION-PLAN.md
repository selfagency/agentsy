# CLI Implementation Plan

## Overview
Production-ready CLI offering TUI, REPL, local dev server, VS Code integration, and built-in loops. Will incorporate advanced document retrieval and code indexing for agent-aware conversations. Integrates with universal-client for provider abstraction and runtime for execution.

## Advanced Document Retrieval & Code Indexing

### Core Architecture (SQLite + Vector Search)
Adopt production patterns from sqlite-ollama-rag, turso.tech, and SQLite.ai blog:

```typescript
// Unified document store combining SQL + Vector search
interface DocumentStore {
  // Database schema
  documents: {
    id: string
    content: string
    type: 'file' | 'directory' | 'project' | 'web' | 'conversation'
    path: string
    language: string
    metadata: Record<string, unknown>
    embedding: Float32Array
    created_at: datetime
    updated_at: datetime
    access_count: number
    last_accessed: datetime
    tags: string[]
  }
  
  // Relational connections
  relationships: {
    parent_id: string
    child_id: string
    relationship_type: 'contains' | 'imports' | 'references' | 'similar'
    strength: number
  }
  
  // Project structure awareness
  project_structure: {
    project_root: string
    relative_path: string
    file_type: string
    dependencies: string[]
    package_info?: {
      name: string
      version: string
      exports: string[]
    }
  }
}
```

### Multi-Modal Indexing Strategy
Inspired by RAG-SQLITE-VEC-MODULE and inferable SQLite RAG:

```typescript
interface IndexingPipeline {
  // File-based indexing (like sourcebot)
  fileIndexer: {
    supportedTypes: ['ts', 'js', 'py', 'java', 'go', 'rs', 'vue', 'svelte', 'jsx', 'tsx']
    chunkStrategy: 'semantic' | 'syntactic' | 'hybrid'
    extractFunctions: boolean
    extractTypes: boolean
    extractComments: boolean
    includeDependencies: boolean
  }
  
  // Directory and project structure (like superset)
  structureIndexer: {
    trackFileMoves: boolean
    trackDependencies: boolean
    trackImports: boolean
    trackPackageStructure: boolean
    buildDependencyGraph: boolean
  }
  
  // Web content indexing (like RAGlite)
  webIndexer: {
    supportedFormats: ['html', 'md', 'api-docs', 'wiki']
    extractCodeBlocks: boolean
    extractMetadata: boolean
    respectRobotsTxt: boolean
  }
  
  // Conversation indexing (like agentic RAG checkpointer)
  conversationIndexer: {
    trackContext: boolean
    trackToolCalls: boolean
    trackDecisions: boolean
    trackSummaries: boolean
  }
}
```

### Hybrid Search Strategy
Combine SQL precision with Vector similarity:

```typescript
interface HybridSearchEngine {
  // SQL queries for precise filtering
  sqlQueries: {
    byProject: 'SELECT * FROM documents WHERE project_root = ?'
    byFileType: 'SELECT * FROM documents WHERE file_type = ?'
    byDependencies: 'SELECT * FROM documents WHERE JSON_search(dependencies, ?, ?)'
    byAccessPattern: 'SELECT * FROM documents ORDER BY access_count DESC'
    byRecency: 'SELECT * FROM documents WHERE updated_at > ?'
  }
  
  // Vector search for semantic similarity
  vectorSearch: {
    embeddingModel: 'text-embedding-3-small' | 'local-embeddings'
    similarityThreshold: 0.7
    maxResults: 10
    rerankByRecency: boolean
    rerankByFrequency: boolean
  }
  
  // Combined query optimization
  hybridQueries: {
    semanticPrecise: 'Vector + SQL by project/file type'
    contextualAware: 'Vector + conversation history + recent access'
    dependencyAware: 'Vector + import graph + package structure'
    trending: 'Vector + access frequency + recency'
  }
}
```

### Smart Context Building
Learn from sourcebot and memelord patterns:

```typescript
interface ContextBuilder {
  // Multi-level context hierarchy
  contextLevels: {
    immediate: {
      file: string | null
      directory: string | null
      imports: string[]
      exports: string[]
    }
    project: {
      structure: FileTree
      dependencies: PackageGraph
      recentChanges: FileChange[]
    }
    related: {
      similarFiles: Document[]
      referencedFiles: Document[]
      dependentFiles: Document[]
    }
    conversational: {
      recentTopics: string[]
      decisions: Decision[]
      patterns: Pattern[]
    }
  }
  
  // Context optimization
  optimization: {
    maxTokens: 4096
    priorityWeighting: {
      currentFile: 1.0
      imports: 0.8
      directory: 0.6
      similar: 0.4
      conversational: 0.3
      projectOverview: 0.2
    }
    deduplication: true
    relevanceScore: boolean
  }
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

### From SQLite.ai Blog:
- RAG on SQLite with vector extensions
- Efficient hybrid search combining SQL + vectors
- Real-time indexing with FTS5

### From turso.tech:
- Edge SQLite for vector search
- Scalable document retrieval
- Production-ready vector operations

### From sqlite-ollama-rag:
- Local embedding generation
- Efficient chunking strategies
- Context-aware retrieval

### From RAG-SQLITE-VEC-MODULE:
- SQLite vector extensions
- High-performance similarity search
- Optimized storage format

### From sourcebot:
- Code-aware indexing
- Dependency graph tracking
- Semantic code understanding

### From inferable SQLite RAG:
- RAG checkpointer for conversations
- Context persistence
- Multi-turn conversation support

### From superset-sh/superset:
- Large-scale document handling
- Efficient metadata management
- Advanced filtering capabilities

### From spiceai:
- Time-series document tracking
- Change detection
- Historical context preservation

### From agentic RAG with SQLite checkpointer:
- Agent-specific context tracking
- Decision persistence
- Workflow-aware retrieval

## Usage Examples

### Initialize indexing for a project:
```bash
agentsy index --project ./my-project --deep
agentsy index --web https://docs.example.com --recursive
agentsy index --conversation --history 50
```

### Smart context-aware chat:
```bash
agentsy chat --context-aware --max-tokens 4096
agentsy chat --context ./src/utils.ts --include-dependencies
agentsy chat --context recent --limit 10
```

### Search and retrieve:
```bash
agentsy search "authentication patterns" --type code --limit 5
agentsy search --similar ./src/auth.ts --threshold 0.8
agentsy search --web --api-docs --query "react hooks"
```

### Interactive development:
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