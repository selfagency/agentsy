import { fingerprintContent } from '../../content-addressing/fingerprint.js';
import { createEntityExtractor, type EntityExtractor } from '../../wiki/entity-extractor.js';

export interface GraphNode {
  id: string;
  kind: 'person' | 'organization' | 'technology' | 'concept' | 'unknown';
  label: string;
  importance: number;
  firstSeen: number;
  lastSeen: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
}

export interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface KnowledgeGraph {
  addNode(node: GraphNode): void;
  addEdge(edge: GraphEdge): void;
  query(entity: string, depth?: number): Subgraph;
  merge(other: KnowledgeGraph): number;
  nodeCount(): number;
  edgeCount(): number;
  nodes(): readonly GraphNode[];
  edges(): readonly GraphEdge[];
}

export interface KnowledgeGraphOptions {
  entityExtractor?: EntityExtractor;
}

function nodeKey(label: string): string {
  return fingerprintContent(label.toLowerCase()).value;
}

function edgeKey(from: string, to: string, relation: string): string {
  return `${from}|${relation}|${to}`;
}

export function createKnowledgeGraph(_options: KnowledgeGraphOptions = {}): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  return {
    addNode(node: GraphNode): void {
      nodes.set(node.id, node);
    },

    addEdge(edge: GraphEdge): void {
      edges.set(edgeKey(edge.from, edge.to, edge.relation), edge);
    },

    query(entity: string, depth: number = 1): Subgraph {
      const entityId = nodeKey(entity);
      const resultNodes = new Map<string, GraphNode>();
      const resultEdges = new Map<string, GraphEdge>();

      function walk(currentId: string, currentDepth: number): void {
        if (currentDepth > depth) return;
        const node = nodes.get(currentId);
        if (!node) return;
        resultNodes.set(currentId, node);

        if (currentDepth === depth) return;

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
      return {
        nodes: [...resultNodes.values()],
        edges: [...resultEdges.values()]
      };
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
  ingest(content: string): { nodes: number; edges: number };
  ingestBatch(contents: string[]): { nodes: number; edges: number };
  getGraph(): KnowledgeGraph;
}

export interface GraphBuilderOptions {
  graph?: KnowledgeGraph;
  entityExtractor?: EntityExtractor;
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
      // nosemgrep: entity.kind lookup in kindMap with safe fallback to 'unknown'
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
