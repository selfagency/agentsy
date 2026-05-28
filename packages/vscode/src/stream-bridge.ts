import type { StreamChunk } from '@agentsy/core/processor';

import { mapStreamChunkToVsCode } from './message-conversion/helpers.js';
import type { LanguageModelChatResponseChunk } from './provider/base-language-model-chat-provider.js';

export interface VSCodeStreamBridgeOptions {
  /**
   * Called when a VS Code-compatible chunk is ready.
   * This should typically yield to the VS Code response stream.
   */
  onChunk: (chunk: LanguageModelChatResponseChunk) => void | Promise<void>;

  /**
   * Optional callback for @agentsy/processor raw StreamChunks.
   */
  onRawChunk?: (chunk: StreamChunk) => void | Promise<void>;
}

/**
 * A bridge that converts an @agentsy/processor StreamChunk sequence into a
 * synchronous VS Code LanguageModelChatProvider response stream.
 */
export class VSCodeStreamBridge {
  private readonly options: VSCodeStreamBridgeOptions;

  constructor(options: VSCodeStreamBridgeOptions) {
    this.options = options;
  }

  /**
   * Processes an @agentsy/core StreamChunk and surfaces it to VS Code.
   */
  async write(chunk: StreamChunk): Promise<void> {
    if (this.options.onRawChunk) {
      await this.options.onRawChunk(chunk);
    }

    const vsChunks = mapStreamChunkToVsCode(chunk);
    for (const vsChunk of vsChunks) {
      await this.options.onChunk(vsChunk);
    }
  }
}

/**
 * Utility to convert an @agentsy/processor AsyncIterable<StreamChunk> into a
 * VS Code-compatible AsyncIterable<LanguageModelChatResponseChunk>.
 */
export async function* bridgeStream(source: AsyncIterable<StreamChunk>): AsyncIterable<LanguageModelChatResponseChunk> {
  for await (const chunk of source) {
    const vsChunks = mapStreamChunkToVsCode(chunk);
    for (const vsChunk of vsChunks) {
      yield vsChunk;
    }
  }
}
