import type { UsageStatusBarConfig, UsageQuota } from '../types/errors.js';

const DEFAULT_REFRESH_INTERVAL = 60_000;
const DEFAULT_TOOLTIP = '{{used}} / {{total}} {{unit}} used ({{percent}}%)';
const DEFAULT_WARNING_THRESHOLD = 0.8;
const DEFAULT_ERROR_THRESHOLD = 0.95;

/**
 * Displays quota usage in the VS Code status bar with configurable thresholds.
 * Uses dynamic import to gracefully degrade when VS Code is unavailable.
 */
export class UsageStatusBar {
  private statusBarItem: { text: string; tooltip: string; backgroundColor?: { new(color: string): unknown }; color?: string; show(): void; hide(): void; dispose(): void } | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor(private readonly config: UsageStatusBarConfig) {}

  /**
   * Initialize and show the status bar item.
   * No-op if VS Code is unavailable.
   */
  async show(): Promise<void> {
    try {
      const vscode = await import('vscode');
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
      );
      if (this.config.onClickRefresh) {
        (this.statusBarItem as unknown as Record<string, unknown>)['command'] = 'agentsy.refreshUsage';
      }
      this.disposables.push(this.statusBarItem);
      await this.refresh();
      this.statusBarItem.show();
      this.startAutoRefresh();
    } catch {
      // VS Code not available
    }
  }

  /**
   * Refresh quota from data source and update display.
   */
  async refresh(): Promise<UsageQuota | undefined> {
    try {
      const quota = await this.config.quotaDataSource.refreshQuota();
      this.updateDisplay(quota);
      return quota;
    } catch {
      return undefined;
    }
  }

  /**
   * Update the status bar display for a given quota.
   */
  updateDisplay(quota: UsageQuota): void {
    if (!this.statusBarItem) return;

    const percent = Math.round(quota.percentUsed * 100);
    const warning = this.config.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
    const error = this.config.errorThreshold ?? DEFAULT_ERROR_THRESHOLD;

    const text = `$(pulse) ${this.config.displayName}: ${quota.used.toLocaleString()} / ${quota.total.toLocaleString()} ${quota.unit}`;
    this.statusBarItem.text = text;

    const template = this.config.tooltipTemplate ?? DEFAULT_TOOLTIP;
    this.statusBarItem.tooltip = template
      .replace('{{used}}', quota.used.toLocaleString())
      .replace('{{total}}', quota.total.toLocaleString())
      .replace('{{unit}}', quota.unit)
      .replace('{{percent}}', String(percent));

    if (quota.percentUsed >= error) {
      const colorScheme = this.config.colorScheme;
      if (colorScheme) {
        (this.statusBarItem as unknown as Record<string, unknown>)['color'] = colorScheme.error;
      }
    } else if (quota.percentUsed >= warning) {
      const colorScheme = this.config.colorScheme;
      if (colorScheme) {
        (this.statusBarItem as unknown as Record<string, unknown>)['color'] = colorScheme.warning;
      }
    } else {
      const colorScheme = this.config.colorScheme;
      if (colorScheme) {
        (this.statusBarItem as unknown as Record<string, unknown>)['color'] = colorScheme.normal;
      }
    }
  }

  /**
   * Hide the status bar item.
   */
  hide(): void {
    this.statusBarItem?.hide();
  }

  dispose(): void {
    this.stopAutoRefresh();
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.config.quotaDataSource.dispose?.();
  }

  private startAutoRefresh(): void {
    const interval = this.config.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL;
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, interval);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer !== undefined) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}

/**
 * Format quota percentage as a short string for status bar display.
 */
export function formatQuotaText(quota: UsageQuota): string {
  const percent = Math.round(quota.percentUsed * 100);
  return `${quota.used.toLocaleString()} / ${quota.total.toLocaleString()} ${quota.unit} (${percent}%)`;
}

/**
 * Determine the status level based on percentage thresholds.
 */
export function getQuotaStatus(
  percentUsed: number,
  warningThreshold = DEFAULT_WARNING_THRESHOLD,
  errorThreshold = DEFAULT_ERROR_THRESHOLD,
): 'normal' | 'warning' | 'error' {
  if (percentUsed >= errorThreshold) return 'error';
  if (percentUsed >= warningThreshold) return 'warning';
  return 'normal';
}
