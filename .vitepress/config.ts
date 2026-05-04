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
      { text: 'Packages', link: '/packages' },
      {
        text: 'Learn',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Roadmap', link: '/roadmap' },
        ],
      },
      {
        text: 'API',
        items: [{ text: 'API index', link: '/api' }],
      },
      { text: 'Developers', link: '/developers/' },
    ],
    sidebar: {
      '/packages/': [
        {
          text: 'Packages',
          items: [{ text: '@agentsy/vscode (VS Code)', link: '/packages/vscode' }],
        },
        {
          text: 'Roadmap',
          items: [{ text: 'Roadmap overview', link: '/roadmap' }],
        },
      ],
      '/developers/': [
        { text: 'Developer Guide', link: '/developers/' },
        { text: 'Contributing', link: '/developers/contributing' },
        { text: 'Integration Guide', link: '/developers/integration-copilot' },
        { text: 'Releasing', link: '/developers/releasing' },
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
