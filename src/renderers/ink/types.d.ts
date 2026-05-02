declare module 'cli-markdown' {
  const render: (markdown: string, options?: Record<string, unknown>) => string;
  export default render;
}
