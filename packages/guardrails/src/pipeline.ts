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
    if (idx === -1) return false;
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
    let blockResult: GuardrailResult | undefined;
    let transformResult: GuardrailResult | undefined;
    let escalateResult: GuardrailResult | undefined;

    for (const scanner of this.#scanners) {
      const result = await scanner.evaluate(input, context);

      if (result.status === 'block') {
        if (this.#config.shortCircuitOnBlock ?? true) {
          return result;
        }
        // Without short-circuit, capture first block and collect detections
        blockResult ??= result;
        if (result.detections) {
          for (const d of result.detections) {
            addDetection(detections, d, this.#config.maxDetections ?? 50);
          }
        }
      } else if (result.status === 'transform') {
        // Apply transformation and remember it (subsequent scanners may add more)
        if (result.detections) {
          for (const d of result.detections) {
            addDetection(detections, d, this.#config.maxDetections ?? 50);
          }
        }
        transformResult = result;
      } else if (result.status === 'escalate') {
        if (result.detections) {
          for (const d of result.detections) {
            addDetection(detections, d, this.#config.maxDetections ?? 50);
          }
        }
        // Keep the highest-risk escalate
        if (!escalateResult) {
          escalateResult = result;
        } else if (result.riskScore > (escalateResult as typeof result).riskScore) {
          escalateResult = result;
        }
      }
    }

    // Priority: block > transform > escalate > pass (non-short-circuit)
    if (blockResult) {
      return detections.length > 0 ? ({ ...blockResult, detections } as GuardrailResult) : blockResult;
    }
    if (transformResult) {
      return detections.length > 0 ? ({ ...transformResult, detections } as GuardrailResult) : transformResult;
    }
    if (escalateResult) {
      return detections.length > 0 ? ({ ...escalateResult, detections } as GuardrailResult) : escalateResult;
    }
    return { status: 'pass', phase };
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

/**
 * Append a detection, respecting the max limit.
 */
function addDetection(dest: Detection[], detection: Detection, max: number): void {
  if (dest.length >= max) return;
  dest.push(detection);
}
