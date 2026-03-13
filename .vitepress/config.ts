import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '@selfagency/llm-stream-parser',
  description: 'Composable parsers and stream processing utilities for LLM responses',
  base: '/',
  srcDir: 'docs',
  outDir: '.gh-pages',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting started', link: '/getting-started' },
      { text: 'API Reference', link: '/api' },
      { text: 'Developers', link: '/developers/' },
      { text: 'GitHub', link: 'https://github.com/selfagency/llm-stream-parser' }
    ],
    sidebar: {
      '/developers/': [
        { text: 'Developer Guide', link: '/developers/' },
        { text: 'Contributing', link: '/developers/contributing' },
        { text: 'Integration Guide', link: '/developers/integration-copilot' }
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/selfagency/llm-stream-parser' }]
  }
});
