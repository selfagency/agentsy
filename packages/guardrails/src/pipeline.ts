import type { Detection, GuardrailPhase, GuardrailResult, GuardrailScanner, PipelineConfig } from './types.js';

/**
 * A sequential guardrail evaluation pipeline.
 *
 * Scanners are sorted by `metadata.priority` (ascending) at registration.
 * By default the pipeline short-circuits on the first `block` result.
 */
export class GuardrailPipeline {
  readonly #scanners: GuardrailScanner[] = [];
  #config: PipelineConfig;

  constructor(config?: PipelineConfig) {
    this.#config = { shortCircuitOnBlock: true, promptOnEscalate: false, maxDetections: 50, ...config };
  }

  // ===========================================================================
  // Registration
  // ===========================================================================

  /**
   * Register one or more scanners. They are inserted in priority order.
   */
  add(...scanners: GuardrailScanner[]): void {
    for (const scanner of scanners) {
      this.#scanners.push(scanner);
    }
    this.#scanners.sort((a, b) => a.metadata.priority - b.metadata.priority);
  }

  /**
   * Remove a scanner by its metadata id.
   */
  remove(id: string): boolean {
    const idx = this.#scanners.findIndex(s => s.metadata.id === id);
    if (idx === -1) {
      return false;
    }
    this.#scanners.splice(idx, 1);
    return true;
  }

  /**
   * Replace the pipeline configuration at runtime.
   */
  configure(config: Partial<PipelineConfig>): void {
    this.#config = { ...this.#config, ...config };
  }

  // ===========================================================================
  // Evaluation
  // ===========================================================================

  /**
   * Evaluate all registered scanners against the given input for a phase.
   *
   * Returns the first `block` result (if shortCircuitOnBlock is true), or
   * collects all detections and returns the most severe non-pass result.
   */
  async evaluate(input: string, phase: GuardrailPhase, context?: Record<string, unknown>): Promise<GuardrailResult> {
    const detections: Detection[] = [];
    let currentInput = input;
    let blockResult: GuardrailResult | undefined;
    let transformResult: GuardrailResult | undefined;
    let escalateResult: GuardrailResult | undefined;

    for (const scanner of this.#scanners) {
      const result = await scanner.evaluate(currentInput, context);
      this.#collectResult(result, detections);

      const ps = this.#applyResult(result, blockResult, transformResult, escalateResult, currentInput);
      blockResult = ps.blockResult;
      transformResult = ps.transformResult;
      escalateResult = ps.escalateResult;
      currentInput = ps.input;

      if (result.status === 'block' && (this.#config.shortCircuitOnBlock ?? true)) {
        return result;
      }
    }

    return this.#resolvePriority(blockResult, transformResult, escalateResult, detections, phase);
  }

  /**
   * Apply a single scanner result, updating priority accumulators and chaining transforms.
   */
  #applyResult(
    result: GuardrailResult,
    blockResult: GuardrailResult | undefined,
    transformResult: GuardrailResult | undefined,
    escalateResult: GuardrailResult | undefined,
    currentInput: string
  ): {
    blockResult: GuardrailResult | undefined;
    transformResult: GuardrailResult | undefined;
    escalateResult: GuardrailResult | undefined;
    input: string;
  } {
    let escalated = escalateResult;
    let transformed = transformResult;
    let blocked = blockResult;
    let nextInput = currentInput;

    if (result.status === 'block') {
      blocked ??= result;
    }
    if (result.status === 'transform') {
      transformed = result;
      if (result.sanitized !== undefined) {
        nextInput = result.sanitized;
      }
    }
    if (
      result.status === 'escalate' &&
      (result.riskScore ?? 0) > ((escalated?.status === 'escalate' ? escalated.riskScore : 0) ?? 0)
    ) {
      escalated = result;
    }

    return {
      blockResult: blocked,
      input: nextInput,
      transformResult: transformed,
      escalateResult: escalated
    };
  }

  /**
   * Resolve the most severe result across all scanners.
   * Priority: block > transform > escalate > pass.
   */
  #resolvePriority(
    blockResult: GuardrailResult | undefined,
    transformResult: GuardrailResult | undefined,
    escalateResult: GuardrailResult | undefined,
    detections: Detection[],
    phase: GuardrailPhase
  ): GuardrailResult {
    if (blockResult) {
      return detections.length > 0 ? { ...blockResult, detections } : blockResult;
    }
    if (transformResult) {
      return detections.length > 0 ? { ...transformResult, detections } : transformResult;
    }
    if (escalateResult) {
      return detections.length > 0 ? { ...escalateResult, detections } : escalateResult;
    }
    return { status: 'pass', phase };
  }

  /**
   * Collect detections from a result, respecting the max limit.
   */
  #collectResult(result: GuardrailResult, dest: Detection[]): void {
    if (result.status === 'pass') {
      return;
    }
    const detectionList = result.detections ?? [];
    for (const d of detectionList) {
      if (dest.length >= (this.#config.maxDetections ?? 50)) {
        break;
      }
      dest.push(d);
    }
  }

  /**
   * Shortcut to evaluate only `input`-phase scanners.
   */
  evaluateInput(input: string, context?: Record<string, unknown>): Promise<GuardrailResult> {
    return this.evaluate(input, 'input', context);
  }

  /**
   * Shortcut to evaluate only `output`-phase scanners.
   */
  evaluateOutput(input: string, context?: Record<string, unknown>): Promise<GuardrailResult> {
    return this.evaluate(input, 'output', context);
  }

  // ===========================================================================
  // Introspection
  // ===========================================================================

  listScanners(): readonly GuardrailScanner[] {
    return [...this.#scanners];
  }

  get size(): number {
    return this.#scanners.length;
  }

  clear(): void {
    this.#scanners.length = 0;
  }
}
