export type EntityKind =
  | "technology"
  | "organization"
  | "person"
  | "concept"
  | "unknown";

export interface ExtractedEntity {
  name: string;
  kind: EntityKind;
  confidence: number;
}

export interface EntityRelationship {
  from: string;
  to: string;
  relation: "co_occurs_with";
  confidence: number;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relationships: EntityRelationship[];
}

export interface EntityExtractor {
  extract(content: string): EntityExtractionResult;
}

const TOKEN_PATTERN = /\b(?:[A-Z][A-Za-z0-9_-]+|[A-Z]{2,})\b/g;

function classifyEntity(name: string): EntityKind {
  if (/(Inc|Corp|LLC|Ltd|Foundation)$/u.test(name)) {
    return "organization";
  }

  if (/^(OAuth|OpenID|PKCE|Redis|SQLite|Turso|LLM|MCP)$/u.test(name)) {
    return "technology";
  }

  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/u.test(name)) {
    return "concept";
  }

  return "unknown";
}

function toConfidence(occurrences: number): number {
  return Math.min(1, 0.5 + occurrences * 0.15);
}

function normalizeSentence(sentence: string): string {
  return sentence.replaceAll(/\s+/g, " ").trim();
}

export function createEntityExtractor(): EntityExtractor {
  return {
    extract(content) {
      const frequency = new Map<string, number>();
      const matches = content.match(TOKEN_PATTERN) ?? [];

      for (const match of matches) {
        frequency.set(match, (frequency.get(match) ?? 0) + 1);
      }

      const entities: ExtractedEntity[] = [...frequency.entries()]
        .map(([name, occurrences]) => ({
          confidence: toConfidence(occurrences),
          kind: classifyEntity(name),
          name,
        }))
        .toSorted(
          (left, right) =>
            right.confidence - left.confidence ||
            left.name.localeCompare(right.name)
        );

      const entitySet = new Set(entities.map((entity) => entity.name));
      const relationships: EntityRelationship[] = [];
      const seenEdges = new Set<string>();
      const sentences = content
        .split(/[.!?]\s+/u)
        .map(normalizeSentence)
        .filter(Boolean);

      for (const sentence of sentences) {
        const sentenceEntities = [
          ...new Set(sentence.match(TOKEN_PATTERN) ?? []),
        ].filter((name) => entitySet.has(name));
        for (let i = 0; i < sentenceEntities.length; i += 1) {
          for (let j = i + 1; j < sentenceEntities.length; j += 1) {
            const from = sentenceEntities[i];
            const to = sentenceEntities[j];
            if (!from || !to) {
              continue;
            }

            const edgeKey = `${from}->${to}`;
            if (seenEdges.has(edgeKey)) {
              continue;
            }

            seenEdges.add(edgeKey);
            relationships.push({
              confidence: 0.6,
              from,
              relation: "co_occurs_with",
              to,
            });
          }
        }
      }

      return { entities, relationships };
    },
  };
}
