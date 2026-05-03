import type {
  ExtensionContext,
  SecretStorage,
  Memento,
} from 'vscode';

/**
 * Mock SecretStorage for testing.
 */
export class MockSecretStorage implements SecretStorage {
  private storage: Map<string, string> = new Map();

  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async onDidChange() {
    // Mock implementation
  }

  // Clear for test cleanup
  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock Memento for testing.
 */
export class MockMemento implements Memento {
  private storage: Map<string, unknown> = new Map();

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.storage.get(key) as T) ?? defaultValue;
  }

  update(key: string, value: unknown): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock ExtensionContext for testing.
 */
export function createMockExtensionContext(): ExtensionContext {
  return {
    subscriptions: [],
    extensionPath: '/mock/path',
    extensionUri: {
      scheme: 'file',
      authority: '',
      path: '/mock/path',
      query: '',
      fragment: '',
      fsPath: '/mock/path',
      with: () => ({
        scheme: 'file',
        authority: '',
        path: '/mock/path',
        query: '',
        fragment: '',
        fsPath: '/mock/path',
        with: () => ({} as any),
        toJSON: () => ({}),
      } as any),
      toJSON: () => ({}),
    } as any,
    globalStoragePath: '/mock/global',
    globalStorageUri: {
      scheme: 'file',
      authority: '',
      path: '/mock/global',
      query: '',
      fragment: '',
      fsPath: '/mock/global',
      with: () => ({} as any),
      toJSON: () => ({}),
    } as any,
    workspaceStoragePath: '/mock/workspace',
    workspaceStorageUri: {
      scheme: 'file',
      authority: '',
      path: '/mock/workspace',
      query: '',
      fragment: '',
      fsPath: '/mock/workspace',
      with: () => ({} as any),
      toJSON: () => ({}),
    } as any,
    logPath: '/mock/log',
    logUri: {
      scheme: 'file',
      authority: '',
      path: '/mock/log',
      query: '',
      fragment: '',
      fsPath: '/mock/log',
      with: () => ({} as any),
      toJSON: () => ({}),
    } as any,
    logsPath: '/mock/logs',
    secrets: new MockSecretStorage(),
    globalState: new MockMemento(),
    workspaceState: new MockMemento(),
    extensionMode: 0 as any,
    environmentVariableCollection: {} as any,
  } as any;
}
