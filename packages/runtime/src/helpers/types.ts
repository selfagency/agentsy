export interface RuntimeHelperInvocation<TInput = unknown> {
  helperId: string;
  input: TInput;
  sessionId: string;
}

export interface RuntimeHelperExecutionResult<TOutput = unknown> {
  helperId: string;
  output: TOutput;
  sessionId: string;
}

export type RuntimeHelperExecutor<TInput = unknown, TOutput = unknown> = (
  invocation: RuntimeHelperInvocation<TInput>,
  signal: AbortSignal
) => Promise<TOutput>;
