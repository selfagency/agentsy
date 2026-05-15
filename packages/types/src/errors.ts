/**
 * Base error class for all Agentsy errors.
 *
 * Provides consistent error structure and metadata across the system.
 */
export class AgentsyError extends Error {
  public readonly code: string;
  public details: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AgentsyError';
    this.code = code;
    this.details = details ?? {};

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): { name: string; message: string; code: string; details: Record<string, unknown> } {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}
