import type { Event, ExtensionContext, Memento, SecretStorage, SecretStorageChangeEvent } from 'vscode';

/**
 * Mock Event implementation for testing.
 */
function createMockEvent<T>(): Event<T> {
  return (_listener: (e: T) => void) => ({
    dispose: () => {
      /* noop */
    }
  });
}

/**
 * Mock SecretStorage for testing.
 */
export class MockSecretStorage implements SecretStorage {
  private readonly storage = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.storage.keys()];
  }

  onDidChange: Event<SecretStorageChangeEvent> = createMockEvent();

  // Clear for test cleanup
  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock Memento for testing.
 */
export class MockMemento implements Memento {
  private readonly storage = new Map<string, unknown>();

  keys(): readonly string[] {
    return [...this.storage.keys()];
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.storage.get(key) as T) ?? defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.storage.set(key, value);
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock ExtensionContext for testing.
 */
export function createMockExtensionContext(): ExtensionContext {
  const mockUri = {
    authority: '',
    fragment: '',
    fsPath: '/mock/path',
    path: '/mock/path',
    query: '',
    scheme: 'file',
    toJSON: () => ({}),
    with: () =>
      ({
        authority: '',
        fragment: '',
        fsPath: '/mock/path',
        path: '/mock/path',
        query: '',
        scheme: 'file',
        toJSON: () => ({}),
        with: () => ({})
      }) as unknown
  } as unknown;

  return {
    asAbsolutePath: (relativePath: string) => `/mock/path/${relativePath}`,
    environmentVariableCollection: {} as unknown,
    extension: {
      activate: async () => {
        /* noop */
      },
      exports: undefined,
      extensionPath: '/mock/path',
      extensionUri: mockUri,
      id: 'mock-extension',
      isActive: true,
      packageJSON: {}
    } as unknown,
    extensionMode: 0 as unknown,
    extensionPath: '/mock/path',
    extensionUri: mockUri,
    globalState: new MockMemento(),
    globalStoragePath: '/mock/global',
    globalStorageUri: mockUri,
    languageModelAccessInformation: {
      models: [],
      onDidChange: createMockEvent()
    } as unknown,
    logPath: '/mock/log',
    logUri: mockUri,
    logsPath: '/mock/logs',
    secrets: new MockSecretStorage(),
    storagePath: '/mock/storage',
    storageUri: mockUri,
    subscriptions: [],
    workspaceState: new MockMemento(),
    workspaceStoragePath: '/mock/workspace',
    workspaceStorageUri: mockUri
  } as unknown as ExtensionContext;
}
