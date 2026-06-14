/**
 * cmux transport abstraction.
 *
 * Provides discovery, capability probing, and communication with a cmux
 * multiplexer instance. All cmux functionality is discovery-gated: commands
 * are only exposed when cmux is detected.
 */

import { connect, type Socket } from 'node:net';

// =============================================================================
// Types
// =============================================================================

export interface CmuxCapabilities {
  supportsMultiPane: boolean;
  supportsSidebar: boolean;
  supportsWorkspace: boolean;
  version: string;
}

export interface StatusUpdate {
  message: string;
  status?: 'info' | 'warn' | 'error' | 'done';
  surfaceId?: string;
}

export interface PaneRequest {
  label: string;
  layout: 'grid' | 'main-vertical';
  minHeight?: number;
  minWidth?: number;
}

export interface CmuxTransport {
  getCapabilities(): CmuxCapabilities | null;
  isAvailable(): boolean;
  postNotification(update: StatusUpdate): void;
  requestPane(spec: PaneRequest): Promise<string | null>;
}

// =============================================================================
// Discovery
// =============================================================================

const CMUX_SOCKET_PATH = process.env.CMUX_SOCKET_PATH;
const CMUX_WORKSPACE_ID = process.env.CMUX_WORKSPACE_ID;
const CMUX_SURFACE_ID = process.env.CMUX_SURFACE_ID;

export function getCmuxEnv() {
  return {
    socketPath: CMUX_SOCKET_PATH,
    workspaceId: CMUX_WORKSPACE_ID,
    surfaceId: CMUX_SURFACE_ID
  };
}

/**
 * Detect whether we are running inside cmux by checking environment variables
 * and socket availability.
 */
export async function detectCmux(): Promise<CmuxTransport | null> {
  if (!CMUX_SOCKET_PATH) {
    return null;
  }

  // Only probe the socket — don't connect yet
  try {
    const transport = new CmuxSocketTransport(CMUX_SOCKET_PATH);
    // Quick availability check
    const available = await transport.ping();
    if (!available) {
      return null;
    }
    return transport;
  } catch {
    return null;
  }
}

// =============================================================================
// Socket-based transport
// =============================================================================

class CmuxSocketTransport implements CmuxTransport {
  private socket: Socket | null = null;
  private caps: CmuxCapabilities | null = null;
  private readonly connSocketPath: string;

  constructor(path: string) {
    this.connSocketPath = path;
  }

  isAvailable(): boolean {
    return this.socket !== null || !!CMUX_SOCKET_PATH;
  }

  getCapabilities(): CmuxCapabilities | null {
    return this.caps;
  }

  /**
   * Quick ping to check if cmux is reachable.
   */
  async ping(): Promise<boolean> {
    try {
      this.socket = await this.connectWithTimeout(2000);
      this.caps = await this.queryCapabilities();
      return true;
    } catch {
      this.socket = null;
      return false;
    }
  }

  postNotification(update: StatusUpdate): void {
    if (this.socket === null) {
      return;
    }
    try {
      this.sendMessage({
        type: 'notification',
        payload: update
      });
    } catch {
      /* best-effort */
    }
  }

  async requestPane(spec: PaneRequest): Promise<string | null> {
    if (this.socket === null) {
      return null;
    }
    try {
      const response = await this.sendAndWait({
        type: 'request_pane',
        payload: spec
      });
      const paneId = (response as { paneId?: string }).paneId;
      return paneId ?? null;
    } catch {
      return null;
    }
  }

  private connectWithTimeout(timeoutMs: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const sock = connect(this.connSocketPath, () => {
        sock.removeAllListeners();
        resolve(sock);
      });
      sock.once('error', (err: Error) => {
        sock.removeAllListeners();
        reject(err);
      });
      setTimeout(() => {
        sock.removeAllListeners();
        sock.destroy();
        reject(new Error('Connection timeout'));
      }, timeoutMs);
    });
  }

  private async queryCapabilities(): Promise<CmuxCapabilities> {
    const response = await this.sendAndWait({ type: 'get_capabilities' });
    return {
      version: String(response.version ?? '0.0.0'),
      supportsMultiPane: Boolean(response.supportsMultiPane),
      supportsSidebar: Boolean(response.supportsSidebar),
      supportsWorkspace: Boolean(response.supportsWorkspace)
    };
  }

  private sendMessage(msg: Record<string, unknown>): void {
    this.socket?.write(`${JSON.stringify(msg)}\n`);
  }

  private sendAndWait(msg: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      const onData = (data: Buffer) => {
        this.socket?.removeListener('data', onData);
        try {
          resolve(JSON.parse(data.toString('utf-8')) as Record<string, unknown>);
        } catch {
          resolve({});
        }
      };

      this.socket.on('data', onData);
      this.socket.once('error', (err: Error) => {
        this.socket?.removeListener('data', onData);
        reject(err);
      });

      this.sendMessage(msg);
    });
  }
}
