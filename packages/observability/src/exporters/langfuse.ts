/**
 * Langfuse observability adapter.
 *
 * Langfuse supports the OpenTelemetry Protocol (OTLP) natively, so this adapter
 * extends the standard `OtlpExporter` with Langfuse-specific configuration and
 * metadata conventions.
 *
 * @example
 * ```ts
 * import { LangfuseExporter } from '@agentsy/observability/exporters';
 *
 * const exporter = new LangfuseExporter({
 *   publicKey: process.env.LANGFUSE_PUBLIC_KEY,
 *   secretKey: process.env.LANGFUSE_SECRET_KEY,
 *   projectId: 'my-agent-project'
 * });
 * ```
 */

import { OtlpExporter, type OtlpExporterOptions } from './otlp.js';

/** Options for {@link LangfuseExporter}. */
export interface LangfuseExporterOptions {
  /** Langfuse public key (sent as username in Basic auth). */
  publicKey: string;
  /** Langfuse secret key (sent as password in Basic auth). */
  secretKey: string;
  /** Langfuse project ID or name. */
  projectId?: string;
  /** Custom Langfuse endpoint (default: 'https://cloud.langfuse.com/api/public/otlp/v1/traces'). */
  endpoint?: string;
  /** Custom headers merged into every export request. */
  headers?: Record<string, string>;
  /** Maximum batch size before forcing a flush (default: 64). */
  maxBatchSize?: number;
  /** Flush interval in milliseconds (default: 5000). */
  flushIntervalMs?: number;
}

const DEFAULT_LANGFUSE_ENDPOINT = 'https://cloud.langfuse.com/api/public/otlp/v1/traces';

/**
 * Langfuse-specific exporter.
 *
 * Configures Basic auth from public/secret key pair and sets the
 * default endpoint to Langfuse's OTLP ingestion URL.
 */
export class LangfuseExporter extends OtlpExporter {
  constructor(options: LangfuseExporterOptions) {
    const basicAuth = Buffer.from(`${options.publicKey}:${options.secretKey}`).toString('base64');

    const otlpOptions: OtlpExporterOptions = {
      endpoint: options.endpoint ?? DEFAULT_LANGFUSE_ENDPOINT,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        ...(options.projectId ? { 'X-Langfuse-Project': options.projectId } : {}),
        ...options.headers
      },
      ...(options.maxBatchSize !== undefined ? { maxBatchSize: options.maxBatchSize } : {}),
      ...(options.flushIntervalMs !== undefined ? { flushIntervalMs: options.flushIntervalMs } : {})
    };

    super(otlpOptions);
  }
}
