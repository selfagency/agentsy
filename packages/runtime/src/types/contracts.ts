/**
 * Approval request for tool call execution.
 */
export interface ApprovalRequest {
  requestId: string;
  toolCall: {
    name: string;
    parameters: Record<string, unknown>;
  };
  context: {
    runId: string;
    threadId?: string;
    stepIndex: number;
    conversationState: unknown;
  };
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Approval response from approval engine.
 */
export interface ApprovalResponse {
  requestId: string;
  approved: boolean;
  reason?: string;
  conditions?: ApprovalCondition[];
  timestamp: string;
}

export interface ApprovalCondition {
  type: string;
  requirement: string;
}

/**
 * Approval engine interface for governing tool call execution.
 */
export interface ApprovalEngine {
  /**
   * Request approval for a tool call.
   */
  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;

  /**
   * Check if approval is required for a tool call.
   */
  requiresApproval(toolName: string, parameters: Record<string, unknown>): boolean;

  /**
   * Get approval policy configuration.
   */
  getPolicy(): ApprovalPolicy;

  /**
   * Update approval policy.
   */
  updatePolicy(policy: Partial<ApprovalPolicy>): Promise<void>;
}

export interface ApprovalPolicy {
  autoApprove: Array<{ toolName: string; conditions?: Record<string, unknown> }>;
  requireExplicitApproval: Array<{ toolName: string; conditions?: Record<string, unknown> }>;
  deny: Array<{ toolName: string; conditions?: Record<string, unknown> }>;
}

// ===== Plugin System Types =====

/**
 * Plugin interface for extensible agent behavior.
 */
export interface Plugin {
  /**
   * Plugin name identifier.
   */
  name: string;

  /**
   * Plugin version.
   */
  version: string;

  /**
   * Plugin initialization hook.
   */
  initialize?(context: PluginContext): Promise<void>;

  /**
   * Plugin cleanup hook.
   */
  cleanup?(context: PluginContext): Promise<void>;

  /**
   * Plugin event handlers.
   */
  handlers?: PluginEventHandlers;

  /**
   * Plugin capabilities.
   */
  capabilities?: PluginCapabilities;
}

export interface PluginContext {
  runId: string;
  threadId?: string;
  config: Record<string, unknown>;
}

export interface PluginEventHandlers {
  onEvent?: (event: AgUiEvent) => Promise<void>;
  onToolCall?: (toolCall: ToolCallInfo) => Promise<void>;
  onMemoryAccess?: (access: MemoryAccessInfo) => Promise<void>;
}

export interface AgUiEvent {
  type: string;
  [key: string]: unknown;
}

export interface ToolCallInfo {
  name: string;
  parameters: Record<string, unknown>;
  result?: string;
}

export interface MemoryAccessInfo {
  action: 'store' | 'retrieve' | 'update' | 'delete';
  memoryId?: string;
  query?: string;
}

export interface PluginCapabilities {
  canModifyEvents?: boolean;
  canInterceptToolCalls?: boolean;
  canAccessMemories?: boolean;
  canApproveOperations?: boolean;
}

/**
 * Plugin manager for plugin lifecycle and coordination.
 */
export interface PluginManager {
  /**
   * Register a plugin.
   */
  register(plugin: Plugin): Promise<void>;

  /**
   * Unregister a plugin.
   */
  unregister(name: string): Promise<void>;

  /**
   * Get registered plugin.
   */
  getPlugin(name: string): Plugin | null;

  /**
   * List all registered plugins.
   */
  listPlugins(): string[];

  /**
   * Execute plugin hook.
   */
  executeHook<T>(hookName: string, args: T): Promise<unknown[]>;
}

// ===== Provider Contract Types =====

/**
 * Provider interface for LLM/API integrations.
 */
export interface Provider {
  /**
   * Provider name.
   */
  name: string;

  /**
   * Provider type (anthropic, openai, local, etc.).
   */
  type: ProviderType;

  /**
   * Execute a chat completion request.
   */
  execute(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk>;

  /**
   * Get provider configuration.
   */
  getConfig(): ProviderConfig;

  /**
   * Validate provider configuration.
   */
  validateConfig(config: Partial<ProviderConfig>): boolean;

  /**
   * Get provider capabilities.
   */
  getCapabilities(): ProviderCapabilities;
}

export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'openrouter'
  | 'cohere'
  | 'google-gemini'
  | 'google-vertex'
  | 'gpt4all'
  | 'ollama'
  | 'llama_cpp'
  | 'vllm'
  | 'lmstudio'
  | 'deepseek'
  | 'zai'
  | 'http'
  | 'custom';

export interface ProviderRequest {
  messages: Array<{ role: string; content: string | Array<{ type: string; [key: string]: unknown }> }>;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }>;
    toolChoice?: string;
    stream?: boolean;
  };
}

export interface ProviderResponseChunk {
  type: 'content' | 'tool_call' | 'reasoning' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCallInfo;
  reasoning?: string;
  error?: string;
  done?: boolean;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  project?: string;
  timeout?: number;
  options?: Record<string, unknown>;
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  supportsReasoning: boolean;
  maxTokens: number;
  supportedModels: string[];
}

/**
 * Provider factory for creating provider instances.
 */
export interface ProviderFactory {
  /**
   * Create a provider instance from configuration.
   */
  create(config: ProviderConfig): Promise<Provider>;

  /**
   * Get supported provider type.
   */
  getType(): ProviderType;

  /**
   * Validate provider configuration.
   */
  validateConfig(config: Partial<ProviderConfig>): boolean;
}

/**
 * Provider registry for managing available providers.
 */
export interface ProviderRegistry {
  /**
   * Register a provider factory.
   */
  register(factory: ProviderFactory): void;

  /**
   * Get provider factory for a type.
   */
  getFactory(type: ProviderType): ProviderFactory | null;

  /**
   * Create a provider instance.
   */
  createProvider(type: ProviderType, config: ProviderConfig): Promise<Provider>;

  /**
   * List available provider types.
   */
  listTypes(): ProviderType[];
}

// ===== Skill System Types =====

/**
 * Skill interface for agent capabilities.
 */
export interface Skill {
  /**
   * Skill name.
   */
  name: string;

  /**
   * Skill description.
   */
  description: string;

  /**
   * Skill proficiency level.
   */
  proficiency: ProficiencyLevel;

  /**
   * Skill parameters schema.
   */
  parameters?: Record<string, unknown>;

  /**
   * Skill return type.
   */
  returnType?: string;

  /**
   * Skill examples.
   */
  examples?: Array<{
    input: Record<string, unknown>;
    output: unknown;
  }>;
}

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Skill execution context.
 */
export interface SkillExecutionContext {
  runId: string;
  threadId?: string;
  stepIndex: number;
  agentCapabilities: AgentCapabilities;
  memoryAccess: MemoryContext;
  toolAccess: ToolContext;
}

export type AgentCapabilities = {
  canAcceptUserInput?: boolean;
  canRetry?: boolean;
  canInterrupt?: boolean;
  supportedTools?: ToolCapability[];
  supportedMessageFormats?: string[];
};

export interface ToolCapability {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  returnType?: string;
}

export interface MemoryContext {
  retrieve?: (query: string, options?: unknown) => Promise<unknown[]>;
  store?: (entry: unknown) => Promise<string>;
}

export interface ToolContext {
  executeTool?: (name: string, parameters: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Skill executor for skill runtime execution.
 */
export interface SkillExecutor {
  /**
   * Execute a skill with given context.
   */
  execute(skill: Skill, parameters: Record<string, unknown>, context: SkillExecutionContext): Promise<SkillResult>;

  /**
   * Validate skill parameters.
   */
  validateParameters(skill: Skill, parameters: Record<string, unknown>): ValidationResult;

  /**
   * Get skill requirements.
   */
  getRequirements(skill: Skill): SkillRequirements;
}

export interface SkillResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
}

export interface SkillRequirements {
  requiredCapabilities: string[];
  requiredMemoryAccess: Array<'read' | 'write' | 'delete'>;
  requiredToolAccess: string[];
}

/**
 * Skill registry for managing available skills.
 */
export interface SkillRegistry {
  /**
   * Register a skill.
   */
  register(skill: Skill): void;

  /**
   * Unregister a skill by name.
   */
  unregister(name: string): void;

  /**
   * Get skill by name.
   */
  getSkill(name: string): Skill | null;

  /**
   * List all registered skills.
   */
  listSkills(): Skill[];

  /**
   * Find skills matching a query.
   */
  findSkills(query: string): Skill[];
}

/**
 * Skill profiler for proficiency tracking and assessment.
 */
export interface SkillProfiler {
  /**
   * Assess skill proficiency.
   */
  assessProficiency(skill: Skill, context: SkillExecutionContext): ProficiencyLevel;

  /**
   * Update skill proficiency level.
   */
  updateProficiency(skillName: string, level: ProficiencyLevel): void;

  /**
   * Get proficiency history.
   */
  getProficiencyHistory(skillName: string): ProficiencyChange[];
}

export interface ProficiencyChange {
  level: ProficiencyLevel;
  timestamp: string;
  reason: string;
}
