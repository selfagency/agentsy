/**
 * Logger Implementation
 * 
 * Structured logger with multiple severity levels
 */

import type { Logger } from '../core/types.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Whether to include timestamps */
  includeTimestamp?: boolean;
  /** Optional custom log level names */
  levelNames?: Record<LogLevel, string>;
}

/**
 * Log entry with metadata
 */
export interface LogEntry {
  level: LogLevel;
  levelName: string;
  message: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
  error?: unknown;
}

/**
 * Logger implementation
 */
export class LoggerImpl implements Logger {
  private config: Required<LoggerConfig>;
  private _buffer: LogEntry[] = [];
  private readonly DEFAULT_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
  };

  constructor(config?: LoggerConfig) {
    this.config = {
      minLevel: LogLevel.INFO,
      includeTimestamp: true,
      levelNames: {},
      ...config,
    };
  }

  info(message: string, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, attributes);
  }

  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, attributes);
  }

  warn(message: string, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, attributes);
  }

  error(message: string, attributes?: Record<string, unknown>, error?: unknown): void {
    this.log(LogLevel.ERROR, message, { ...attributes, error } as Record<string, unknown>);
  }

  private log(
    level: LogLevel,
    message: string,
    attributes?: Record<string, unknown>,
  ): void {
    if (level < this.config.minLevel) {
      return; // Below minimum level, skip
    }

    const levelName =
      this.config.levelNames[level] ?? this.DEFAULT_LEVEL_NAMES[level];
    const timestamp = this.config.includeTimestamp ? Date.now() : 0;

    const entry: LogEntry = {
      level,
      levelName,
      message,
      timestamp,
      attributes,
    };

    this._buffer.push(entry);

    // For now, just output to console
    const timestampStr = this.config.includeTimestamp
      ? new Date(timestamp).toISOString()
      : '';
    const prefix = levelName.padEnd(5);
    console.log(
      `[${prefix}${timestampStr ? ' ' + timestampStr : ''}] ${message}`,
      attributes ?? '',
      entry.error ?? '',
    );
  }

  /**
   * Flush all buffered log entries to configured sinks
   */
  flush(): LogEntry[] {
    const entries = [...this._buffer];
    this._buffer = [];
    return entries;
  }

  /**
   * Get all buffered log entries without flushing
   */
  getBufferedEntries(): LogEntry[] {
    return [...this._buffer];
  }
}