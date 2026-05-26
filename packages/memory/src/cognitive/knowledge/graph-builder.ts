import { fingerprintContent } from '../../content-addressing/fingerprint.js';
import { createEntityExtractor, type EntityExtractor } from '../../wiki/entity-extractor.js';

export interface GraphNode {
  firstSeen: number;
  id: string;
  importance: number;
  kind: 'person' | 'organization' | 'technology' | 'concept' | 'unknown';
  label: string;
  lastSeen: number;
}

export interface GraphEdge {
  from: string;
  relation: string;
  to: string;
  weight: number;
}

export interface Subgraph {
  edges: GraphEdge[];
  nodes: GraphNode[];
}

export interface KnowledgeGraph {
  addEdge(edge: GraphEdge): void;
  addNode(node: GraphNode): void;
  edgeCount(): number;
  edges(): readonly GraphEdge[];
  merge(other: KnowledgeGraph): number;
  nodeCount(): number;
  nodes(): readonly GraphNode[];
  query(entity: string, depth?: number): Subgraph;
}

export interface KnowledgeGraphOptions {
  entityExtractor?: EntityExtractor;
}

export function createKnowledgeGraph(_options: KnowledgeGraphOptions = {}): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  function nodeKey(label: string): string {
    return fingerprintContent(label.toLowerCase()).value;
  }

  function edgeKey(from: string, to: string, relation: string): string {
    return `${from}|${relation}|${to}`;
  }

  return {
    addNode(node: GraphNode): void {
      nodes.set(node.id, node);
    },

    addEdge(edge: GraphEdge): void {
      edges.set(edgeKey(edge.from, edge.to, edge.relation), edge);
    },

    query(entity: string, depth = 1): Subgraph {
      const entityId = nodeKey(entity);
      const resultNodes = new Map<string, GraphNode>();
      const resultEdges = new Map<string, GraphEdge>();

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: will refactor later
      function walk(currentId: string, currentDepth: number): void {
        if (currentDepth > depth) {
          return;
        }
        const node = nodes.get(currentId);
        if (!node) {
          return;
        }
        resultNodes.set(currentId, node);

        if (currentDepth === depth) {
          return;
        }

        for (const edge of edges.values()) {
          if (edge.from === currentId || edge.to === currentId) {
            const edgeId = edgeKey(edge.from, edge.to, edge.relation);
            resultEdges.set(edgeId, edge);
            const neighbor = edge.from === currentId ? edge.to : edge.from;
            if (!resultNodes.has(neighbor)) {
              walk(neighbor, currentDepth + 1);
            }
          }
        }
      }

      walk(entityId, 0);
      return { nodes: [...resultNodes.values()], edges: [...resultEdges.values()] };
    },

    merge(other: KnowledgeGraph): number {
      let mergedCount = 0;
      for (const node of other.nodes()) {
        if (!nodes.has(node.id)) {
          nodes.set(node.id, node);
          mergedCount++;
        }
      }
      for (const edge of other.edges()) {
        const key = edgeKey(edge.from, edge.to, edge.relation);
        if (!edges.has(key)) {
          edges.set(key, edge);
          mergedCount++;
        }
      }
      return mergedCount;
    },

    nodeCount(): number {
      return nodes.size;
    },

    edgeCount(): number {
      return edges.size;
    },

    nodes(): readonly GraphNode[] {
      return [...nodes.values()];
    },

    edges(): readonly GraphEdge[] {
      return [...edges.values()];
    }
  };
}

export interface GraphBuilder {
  getGraph(): KnowledgeGraph;
  ingest(content: string): { nodes: number; edges: number };
  ingestBatch(contents: string[]): { nodes: number; edges: number };
}

export interface GraphBuilderOptions {
  entityExtractor?: EntityExtractor;
  graph?: KnowledgeGraph;
  now?: (() => number) | undefined;
}

export function createGraphBuilder(options: GraphBuilderOptions = {}): GraphBuilder {
  const graph = options.graph ?? createKnowledgeGraph();
  const entityExtractor = options.entityExtractor ?? createEntityExtractor();

  function processContent(content: string): { nodes: number; edges: number } {
    const extraction = entityExtractor.extract(content);
    let nodeCount = 0;
    let edgeCount = 0;

    const kindMap: Record<string, GraphNode['kind']> = {
      person: 'person',
      organization: 'organization',
      technology: 'technology',
      concept: 'concept',
      unknown: 'unknown'
    };

    for (const entity of extraction.entities) {
      const kind = kindMap[entity.kind] ?? 'unknown';
      graph.addNode({
        id: fingerprintContent(entity.name.toLowerCase()).value,
        kind,
        label: entity.name,
        importance: entity.confidence,
        firstSeen: performance.now(),
        lastSeen: performance.now()
      });
      nodeCount++;
    }

    for (const rel of extraction.relationships) {
      const fromId = fingerprintContent(rel.from.toLowerCase()).value;
      const toId = fingerprintContent(rel.to.toLowerCase()).value;
      graph.addEdge({
        from: fromId,
        to: toId,
        relation: rel.relation,
        weight: rel.confidence
      });
      edgeCount++;
    }

    return { nodes: nodeCount, edges: edgeCount };
  }

  return {
    ingest(content: string): { nodes: number; edges: number } {
      return processContent(content);
    },

    ingestBatch(contents: string[]): { nodes: number; edges: number } {
      let totalNodes = 0;
      let totalEdges = 0;
      for (const content of contents) {
        const result = processContent(content);
        totalNodes += result.nodes;
        totalEdges += result.edges;
      }
      return { nodes: totalNodes, edges: totalEdges };
    },

    getGraph(): KnowledgeGraph {
      return graph;
    }
  };
}
