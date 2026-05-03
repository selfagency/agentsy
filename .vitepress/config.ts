import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '@agentsy',
  description:
    'Production-grade agent infrastructure for TypeScript. Stream parsing, orchestration, memory, MCP, and multi-agent patterns.',
  base: '/',
  srcDir: 'docs',
  outDir: '.gh-pages',
  head: [['link', { rel: 'canonical', href: 'https://agentsy.self.agency' }]],
  themeConfig: {
    logo: '🤖',
    siteTitle: '@agentsy',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Why @agentsy', link: '/why-agentsy' },
      { text: 'Packages', link: '/packages/core' },
      {
        text: 'Learn',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Concepts', link: '/concepts/architecture' },
          { text: 'Examples', link: '/examples/' },
        ],
      },
      {
        text: 'API',
        items: [
          { text: '@agentsy/core (Stream Parsing)', link: '/api/core' },
          { text: '@agentsy/vscode (VS Code Integration)', link: '/api/vscode' },
        ],
      },
      { text: 'Developers', link: '/developers/' },
    ],
    sidebar: {
      '/packages/': [
        {
          text: 'Available Packages (v0.3.0)',
          items: [
            { text: '@agentsy/core (Foundation)', link: '/packages/core' },
            { text: '@agentsy/vscode (VS Code)', link: '/packages/vscode' },
          ],
        },
        {
          text: 'Coming Soon',
          items: [
            { text: 'Roadmap', link: '/packages/roadmap' },
            { text: 'Agent Runtime', link: '/packages/roadmap#agent' },
            { text: 'Memory & Retrieval', link: '/packages/roadmap#memory' },
            { text: 'Connectors', link: '/packages/roadmap#connectors' },
          ],
        },
      ],
      '/concepts/': [
        {
          text: 'Concepts',
          items: [
            { text: 'Architecture', link: '/concepts/architecture' },
            { text: 'Stream Processing', link: '/concepts/streaming' },
            { text: 'Tool Calling', link: '/concepts/tools' },
            { text: 'Session Management', link: '/concepts/sessions' },
          ],
        },
      ],
      '/developers/': [
        { text: 'Developer Guide', link: '/developers/' },
        { text: 'Contributing', link: '/developers/contributing' },
        { text: 'Integration Guide', link: '/developers/integration-copilot' },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/agentsy/agentsy' },
      { icon: 'npm', link: 'https://www.npmjs.com/org/agentsy' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Open source under MIT License',
      copyright: 'Copyright © 2026 Agentsy Contributors',
    },
  },
});
