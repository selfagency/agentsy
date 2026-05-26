import { describe, expect, it } from 'vitest';

import { fingerprintContent } from '../../content-addressing/fingerprint.js';
import { createGraphBuilder, createKnowledgeGraph } from './graph-builder.js';

describe('KnowledgeGraph', () => {
  it('starts empty', () => {
    const graph = createKnowledgeGraph();
    expect(graph.nodeCount()).toBe(0);
    expect(graph.edgeCount()).toBe(0);
  });

  it('adds nodes and edges', () => {
    const graph = createKnowledgeGraph();
    graph.addNode({
      id: 'node-1',
      kind: 'person',
      label: 'Alice',
      importance: 0.8,
      firstSeen: 0,
      lastSeen: 0
    });
    graph.addEdge({ from: 'node-1', to: 'node-2', relation: 'knows', weight: 0.7 });
    expect(graph.nodeCount()).toBe(1);
    expect(graph.edgeCount()).toBe(1);
  });

  it('queries by entity with depth', () => {
    const graph = createKnowledgeGraph();
    const aliceId = fingerprintContent('alice').value;
    const bobId = fingerprintContent('bob').value;
    const acmeId = fingerprintContent('acme').value;

    graph.addNode({
      id: aliceId,
      kind: 'person',
      label: 'Alice',
      importance: 0.8,
      firstSeen: 0,
      lastSeen: 0
    });
    graph.addNode({
      id: bobId,
      kind: 'person',
      label: 'Bob',
      importance: 0.7,
      firstSeen: 0,
      lastSeen: 0
    });
    graph.addNode({
      id: acmeId,
      kind: 'organization',
      label: 'Acme',
      importance: 0.6,
      firstSeen: 0,
      lastSeen: 0
    });
    graph.addEdge({ from: aliceId, to: bobId, relation: 'knows', weight: 0.5 });
    graph.addEdge({ from: bobId, to: acmeId, relation: 'works_at', weight: 0.9 });

    const subgraph = graph.query('Alice', 1);
    expect(subgraph.nodes.length).toBe(2); // Alice + Bob (depth 1)
    expect(subgraph.edges.length).toBe(1);

    const subgraph2 = graph.query('Alice', 2);
    expect(subgraph2.nodes.length).toBe(3); // Alice + Bob + Acme (depth 2)
  });

  it('merges another graph', () => {
    const g1 = createKnowledgeGraph();
    g1.addNode({
      id: 'a',
      kind: 'concept',
      label: 'TypeScript',
      importance: 0.9,
      firstSeen: 0,
      lastSeen: 0
    });

    const g2 = createKnowledgeGraph();
    g2.addNode({
      id: 'b',
      kind: 'concept',
      label: 'Rust',
      importance: 0.8,
      firstSeen: 0,
      lastSeen: 0
    });

    const merged = g1.merge(g2);
    expect(merged).toBe(1);
    expect(g1.nodeCount()).toBe(2);
  });

  it('returns nodes and edges as readonly arrays', () => {
    const graph = createKnowledgeGraph();
    graph.addNode({
      id: 'x',
      kind: 'concept',
      label: 'Test',
      importance: 0.5,
      firstSeen: 0,
      lastSeen: 0
    });
    expect(graph.nodes().length).toBe(1);
    expect(graph.edges().length).toBe(0);
  });
});

describe('GraphBuilder', () => {
  it('ingests content and extracts nodes', () => {
    const builder = createGraphBuilder();
    const result = builder.ingest('The project uses TypeScript and Redis.');
    expect(result.nodes).toBeGreaterThanOrEqual(1);
    expect(builder.getGraph().nodeCount()).toBeGreaterThanOrEqual(1);
  });

  it('ingests batch of contents', () => {
    const builder = createGraphBuilder();
    const result = builder.ingestBatch(['Alice met Bob at Conference X.', 'The system uses OAuth and PKCE.']);
    expect(result.nodes).toBeGreaterThanOrEqual(1);
    expect(result.edges).toBeGreaterThanOrEqual(0);
    expect(builder.getGraph().nodeCount()).toBeGreaterThanOrEqual(1);
  });

  it('accepts a pre-existing graph', () => {
    const graph = createKnowledgeGraph();
    graph.addNode({
      id: 'existing',
      kind: 'concept',
      label: 'Preload',
      importance: 0.5,
      firstSeen: 0,
      lastSeen: 0
    });
    const builder = createGraphBuilder({ graph });
    const _result = builder.ingest('Alice works with Bob.');
    expect(builder.getGraph().nodeCount()).toBeGreaterThan(1); // existing + extracted
  });
});
