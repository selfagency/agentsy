import type { Observation } from './observation-extractor.js';

export type SpecialistRole = 'deduction' | 'induction' | 'surprisal' | 'temporal';

export interface ConsolidationResult {
  confidence: number;
  id: string;
  inputObservationIds: string[];
  noveltyScore: number;
  output: string;
  role: SpecialistRole;
  tokenCost: number;
}

export interface MergedConsolidation {
  finalConfidence: number;
  id: string;
  mergedSummary: string;
  sourceObservationIds: string[];
  specialistResults: ConsolidationResult[];
}

export interface SpecialistProvider {
  consolidate(input: string, observations: Observation[]): Promise<string>;
  readonly role: SpecialistRole;
}

export interface ConsolidationSpecialist {
  consolidate(role: SpecialistRole, observations: Observation[]): Promise<ConsolidationResult>;
  merge(results: ConsolidationResult[]): Promise<MergedConsolidation>;
  registerProvider(provider: SpecialistProvider): void;
}

export interface ConsolidationSpecialistOptions {
  maxTokenBudgetPerCycle?: number;
  now?: (() => number) | undefined;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

// Heuristic specialist implementations — deterministic, no LLM calls

function runDeductionSpecialist(observations: Observation[]): string {
  // Identify logical implications: if multiple observations agree, strengthen the claim
  const byContent = new Map<string, number>();
  for (const obs of observations) {
    byContent.set(obs.content, (byContent.get(obs.content) ?? 0) + 1);
  }
  const entries = [...byContent.entries()];
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (top && top[1] >= 2) {
    return `Deduced: "${top[0]}" is supported by ${top[1]} observations.`;
  }
  return 'No clear deductions from observations.';
}

function runInductionSpecialist(observations: Observation[]): string {
  // Identify patterns across observations
  const factuals = observations.filter(o => o.kind === 'factual');
  if (factuals.length >= 2) {
    const topics = factuals.map(f => f.content.split(' ').slice(0, 3).join(' '));
    return `Pattern: ${topics.length} factual observations suggest consistent behavior in ${topics[0] ?? 'observed area'}.`;
  }
  const emotionals = observations.filter(o => o.kind === 'emotional');
  if (emotionals.length >= 2) {
    return `Pattern: Recurring emotional theme across ${emotionals.length} observations.`;
  }
  return 'No strong inductive patterns identified.';
}

function runSurprisalSpecialist(observations: Observation[]): string {
  // Find corrective observations (surprising/contradicting)
  const correctives = observations.filter(o => o.kind === 'corrective');
  const firstCorrective = correctives[0];
  if (firstCorrective) {
    return `Lesson learned: ${firstCorrective.content} (confidence: ${firstCorrective.confidence.toFixed(2)})`;
  }
  // Find low-confidence or contradictory observations
  const lowConf = observations.filter(o => o.confidence < 0.5);
  if (lowConf.length > 0) {
    return `Surprising: ${lowConf.length} observations had low confidence and may contradict expectations.`;
  }
  return 'No surprising observations detected.';
}

function runTemporalSpecialist(observations: Observation[]): string {
  // Sort by extraction time, look for trends
  const sorted = [...observations].sort((a, b) => a.extractedAt - b.extractedAt);
  if (sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted.at(-1);
    if (first && last) {
      return `Temporal trend from "${first.content.slice(0, 40)}..." to "${last.content.slice(0, 40)}..." over ${observations.length} observations.`;
    }
  }
  return 'Insufficient temporal data for trend analysis.';
}

function runSpecialist(role: SpecialistRole, observations: Observation[]): string {
  switch (role) {
    case 'deduction':
      return runDeductionSpecialist(observations);
    case 'induction':
      return runInductionSpecialist(observations);
    case 'surprisal':
      return runSurprisalSpecialist(observations);
    case 'temporal':
      return runTemporalSpecialist(observations);
    default:
      return 'Unknown specialist role.';
  }
}

export function createConsolidationSpecialist(options: ConsolidationSpecialistOptions = {}): ConsolidationSpecialist {
  const now = options.now ?? (() => performance.now());
  const maxTokenBudget = options.maxTokenBudgetPerCycle ?? 2000;
  const providers = new Map<SpecialistRole, SpecialistProvider>();

  async function consolidate(role: SpecialistRole, observations: Observation[]): Promise<ConsolidationResult> {
    const provider = providers.get(role);
    const input = observations.map(o => o.content).join('. ');
    let output: string;

    if (provider) {
      output = await provider.consolidate(input, observations);
    } else {
      output = runSpecialist(role, observations);
    }

    const tokenCost = estimateTokens(output);
    const noveltyScore = Math.min(
      1,
      observations.filter(o => o.confidence < 0.6).length / Math.max(1, observations.length)
    );

    return {
      id: `consol-${role}-${now()}`,
      role,
      inputObservationIds: observations.map(o => o.id),
      output,
      confidence: Math.min(
        1,
        observations.reduce((sum, o) => sum + o.confidence, 0) / Math.max(1, observations.length)
      ),
      noveltyScore,
      tokenCost
    };
  }

  function merge(results: ConsolidationResult[]): Promise<MergedConsolidation> {
    if (results.length === 0) {
      return Promise.resolve({
        id: `merge-${now()}`,
        specialistResults: [],
        mergedSummary: '',
        finalConfidence: 0,
        sourceObservationIds: []
      });
    }

    // Deduplicate overlapping summaries
    const unique = new Map<string, ConsolidationResult>();
    for (const r of results) {
      const key = r.output.slice(0, 60);
      if (!unique.has(key) || (unique.get(key)?.confidence ?? 0) < r.confidence) {
        unique.set(key, r);
      }
    }

    const uniqueResults = [...unique.values()];
    const totalTokenCost = uniqueResults.reduce((sum, r) => sum + r.tokenCost, 0);

    // Cap within budget
    let mergedSummary = uniqueResults.map(r => r.output).join(' ');
    if (totalTokenCost > maxTokenBudget) {
      // Truncate to fit budget
      const words = mergedSummary.split(' ');
      const allowedWords = Math.floor(maxTokenBudget / 1.5);
      mergedSummary = `${words.slice(0, allowedWords).join(' ')}...`;
    }

    // Weight by confidence × (1 - redundancy)
    const avgConfidence = uniqueResults.reduce((sum, r) => sum + r.confidence, 0) / uniqueResults.length;
    const agreementBonus = uniqueResults.length >= 2 ? 0.1 : 0;
    const finalConfidence = Math.min(1, avgConfidence + agreementBonus);

    const allSourceIds = [...new Set(uniqueResults.flatMap(r => r.inputObservationIds))];

    return Promise.resolve({
      id: `merge-${now()}`,
      specialistResults: uniqueResults,
      mergedSummary,
      finalConfidence,
      sourceObservationIds: allSourceIds
    });
  }

  return {
    consolidate,
    merge,
    registerProvider(provider: SpecialistProvider): void {
      providers.set(provider.role, provider);
    }
  };
}
