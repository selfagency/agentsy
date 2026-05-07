import { defineConfig } from 'vitepress';

const architectureItems = [
  { text: 'Overview', link: '/architecture/' },
  { text: 'Package ecosystem', link: '/architecture/package-ecosystem' },
  { text: 'Stream processing flow', link: '/architecture/stream-processing' },
  { text: 'Platform evolution', link: '/architecture/platform-evolution' },
];

export default defineConfig({
  title: 'Agentsy',
  description:
    'Composable TypeScript infrastructure for stream parsing, agent loops, renderers, and VS Code integrations.',
  base: '/',
  srcDir: 'docs',
  outDir: '.gh-pages',
  head: [
    ['link', { rel: 'canonical', href: 'https://agentsy.self.agency/' }],
    ['meta', { property: 'og:title', content: 'Agentsy documentation' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Learn how the @agentsy package ecosystem fits together, from provider normalizers and stream processors to agent loops and VS Code integrations.',
      },
    ],
  ],
  themeConfig: {
    logo: '🤖',
    siteTitle: 'Agentsy docs',
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Why Agentsy', link: '/why-agentsy' },
          { text: 'Examples', link: '/examples' },
          { text: 'Migration', link: '/migration' },
        ],
      },
      {
        text: 'Architecture',
        items: architectureItems,
      },
      { text: 'Packages', link: '/packages' },
      {
        text: 'Reference',
        items: [
          { text: 'API index', link: '/api' },
          { text: 'Package catalog', link: '/packages' },
          { text: 'Roadmap', link: '/roadmap' },
        ],
      },
      { text: 'Developers', link: '/developers/' },
    ],
    sidebar: {
      '/architecture/': [
        {
          text: 'Architecture',
          items: architectureItems,
        },
      ],
      '/packages/': [
        {
          text: 'Catalog',
          items: [
            { text: 'Package overview', link: '/packages' },
            { text: '@agentsy/processor', link: '/packages/processor' },
            { text: '@agentsy/normalizers', link: '/packages/normalizers' },
            { text: '@agentsy/agent', link: '/packages/agent' },
            { text: '@agentsy/adapters', link: '/packages/adapters' },
            { text: '@agentsy/renderers', link: '/packages/renderers' },
            { text: '@agentsy/vscode', link: '/packages/vscode' },
          ],
        },
        {
          text: 'Core utilities',
          items: [
            { text: '@agentsy/thinking', link: '/packages/thinking' },
            { text: '@agentsy/tool-calls', link: '/packages/tool-calls' },
            { text: '@agentsy/structured', link: '/packages/structured' },
            { text: '@agentsy/context', link: '/packages/context' },
            { text: '@agentsy/formatting', link: '/packages/formatting' },
            { text: '@agentsy/recovery', link: '/packages/recovery' },
            { text: '@agentsy/xml-filter', link: '/packages/xml-filter' },
            { text: '@agentsy/sse', link: '/packages/sse' },
            { text: '@agentsy/types', link: '/packages/types' },
            { text: '@agentsy/ui', link: '/packages/ui' },
            { text: '@agentsy/ag-ui', link: '/packages/ag-ui' },
            { text: '@agentsy/integration', link: '/packages/integration' },
          ],
        },
      ],
      '/developers/': [
        { text: 'Developer guide', link: '/developers/' },
        { text: 'Contributing', link: '/developers/contributing' },
        { text: 'Copilot integration', link: '/developers/integration-copilot' },
        { text: 'Releasing', link: '/developers/releasing' },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'CLI log summarizer (easy)', link: '/examples/cli-log-summarizer' },
            { text: 'Node DNS blocklist workflow', link: '/examples/dns-blocklist' },
            { text: 'Multi-provider policy gate', link: '/examples/multi-provider-policy-gate' },
            { text: 'Agent tool loop with retries + continuation', link: '/examples/tool-loop-retries-continuation' },
            { text: 'Stateful ops copilot backend', link: '/examples/stateful-ops-copilot' },
            { text: 'All-tooling end-to-end workflow', link: '/examples/all-tooling-end-to-end' },
          ],
        },
      ],
      '/': [
        {
          text: 'Guide',
          items: [
            { text: 'Home', link: '/' },
            { text: 'Getting started', link: '/getting-started' },
            { text: 'Why Agentsy', link: '/why-agentsy' },
            { text: 'Examples', link: '/examples' },
            { text: 'Migrationr', link: '/migration' },
            { text: 'Roadmap', link: '/roadmap' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Architecture', link: '/architecture/' },
            { text: 'Packages', link: '/packages' },
            { text: 'API index', link: '/api' },
            { text: 'Developers', link: '/developers/' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/selfagency/agentsy' },
      { icon: 'npm', link: 'https://www.npmjs.com/org/agentsy' },
    ],
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
    },
    docFooter: {
      prev: 'Previous page',
      next: 'Next page',
    },
    footer: {
      message: 'Open source under MIT License',
      copyright: 'Copyright © 2026 Agentsy Contributors',
    },
  },
});
