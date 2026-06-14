/**
 * MSW request handlers for external connector API endpoints.
 *
 * Simulates Slack, GitHub, and Linear API responses used by
 * @agentsy/connectors and related integration code.
 *
 * @module @agentsy/testing/msw/handlers/connectors
 */

import { type HttpHandler, HttpResponse, http } from 'msw';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackMessage {
  channel: string;
  text: string;
  ts: string;
}

export interface MockConnectorState {
  healthy: boolean;
  slackMessages: SlackMessage[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMockConnectorState(): MockConnectorState {
  return {
    slackMessages: [],
    healthy: true
  };
}

// ---------------------------------------------------------------------------
// Handler factories
// ---------------------------------------------------------------------------

export interface ConnectorHandlerOptions {
  /** Response delay in ms (default: 0) */
  delay?: number;
  /** Shared mutable state */
  state?: MockConnectorState;
}

/**
 * Create connector (Slack, GitHub, Linear) handlers backed by shared mutable state.
 *
 * Supports:
 * - POST https://slack.com/api/chat.postMessage       → send a Slack message
 * - GET  https://slack.com/api/conversations.history   → list Slack messages
 * - GET  https://api.github.com/repos/:owner/:repo     → get a GitHub repo
 * - POST https://api.linear.app/graphql                → Linear GraphQL mutations
 */
export function createConnectorHandlers(options?: ConnectorHandlerOptions): HttpHandler[] {
  const state = options?.state ?? createMockConnectorState();
  const delay = options?.delay ?? 0;

  return [
    // -----------------------------------------------------------------------
    // Slack — chat.postMessage
    // -----------------------------------------------------------------------
    http.post('https://slack.com/api/chat.postMessage', async ({ request }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const payload = (await request.json()) as { channel?: string; text?: string };
      const channel = payload.channel ?? 'C00000000';
      const text = payload.text ?? '';
      const ts = '1503435956.000247';

      state.slackMessages.push({ channel, text, ts });

      return HttpResponse.json(
        {
          channel,
          ok: true,
          ts,
          message: {
            bot_id: 'B00000000',
            type: 'message',
            subtype: 'bot_message',
            text,
            ts,
            username: 'agentsy-bot'
          }
        },
        { status: 200 }
      );
    }),

    // -----------------------------------------------------------------------
    // Slack — conversations.history
    // -----------------------------------------------------------------------
    http.get('https://slack.com/api/conversations.history', async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const messages = state.slackMessages.map(msg => ({
        channel: msg.channel,
        text: msg.text,
        ts: msg.ts,
        type: 'message',
        user: 'U00000000'
      }));

      return HttpResponse.json(
        {
          messages,
          ok: true,
          has_more: false,
          pin_count: 0,
          response_metadata: { next_cursor: '' }
        },
        { status: 200 }
      );
    }),

    // -----------------------------------------------------------------------
    // GitHub — get repository
    // -----------------------------------------------------------------------
    http.get('https://api.github.com/repos/:owner/:repo', async ({ params }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const owner = String(params.owner ?? 'test-owner');
      const repo = String(params.repo ?? 'test-repo');

      return HttpResponse.json(
        {
          id: 1,
          name: repo,
          full_name: `${owner}/${repo}`,
          owner: { login: owner, id: 1, avatar_url: '', gravatar_id: '', url: '', html_url: '', type: 'User' },
          private: false,
          description: 'Mock repository for testing',
          fork: false,
          url: `https://api.github.com/repos/${owner}/${repo}`,
          html_url: `https://github.com/${owner}/${repo}`,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z',
          pushed_at: '2024-06-01T00:00:00Z',
          git_url: `git://github.com/${owner}/${repo}.git`,
          ssh_url: `git@github.com:${owner}/${repo}.git`,
          clone_url: `https://github.com/${owner}/${repo}.git`,
          language: 'TypeScript',
          default_branch: 'main'
        },
        { status: 200 }
      );
    }),

    // -----------------------------------------------------------------------
    // Linear — GraphQL API
    // -----------------------------------------------------------------------
    http.post('https://api.linear.app/graphql', async ({ request }) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const payload = (await request.json()) as {
        query?: string;
        variables?: Record<string, unknown>;
      };
      const query = payload.query ?? '';

      // Detect mutation type from the query string
      if (query.includes('issueCreate')) {
        return HttpResponse.json(
          {
            data: {
              issueCreate: {
                success: true,
                issue: { id: 'linear-1', title: 'Test' }
              }
            }
          },
          { status: 200 }
        );
      }

      // Generic fallback for other mutations/queries
      return HttpResponse.json({ data: {} }, { status: 200 });
    })
  ];
}
