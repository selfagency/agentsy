---
name: ink-cli
description: This skill should be used when building command-line interfaces with React, creating terminal UIs with Ink, developing interactive CLI applications, or working with terminal-based React components
---

# Ink CLI Development

Build interactive command-line applications using React components with Ink.

## What is Ink?

Ink is a React renderer for terminals, allowing you to build CLI applications using familiar React patterns including components, hooks, JSX, and Flexbox layouts. It leverages Yoga (Facebook's Flexbox layout engine) to create responsive terminal UIs.

## When to Use Ink

Use Ink when building:

- Interactive CLI tools requiring user input
- Dashboard-style terminal applications
- Multi-step wizards or forms
- Real-time data displays
- Menu-driven interfaces
- Progress indicators and loading states
- Chat-like interfaces

## Quick Start

### Installation

```bash
npm install ink react
```

For TypeScript:

```bash
npm install --save-dev @types/react
```

### Basic Example

```tsx
import React from 'react';
import {render, Text} from 'ink';

const App = () => <Text color="green">Hello World</Text>;

render(<App />);
```

### Project Structure

```text
my-cli/
├── source/
│   ├── cli.tsx          # Entry point
│   └── app.tsx          # Main component
├── dist/                # Compiled output
├── package.json
└── tsconfig.json
```

## Key Concepts

### 1. Components

Ink provides React components that render to terminal output:

- **Text**: Display styled text
- **Box**: Layout container with Flexbox support
- **Spacer**: Fill available space
- **Static**: Render content only once (for logs)
- **Newline**: Line breaks

See [components.md](references/components.md) for detailed documentation.

### 2. Hooks

Ink extends React with terminal-specific hooks:

- **useInput**: Handle keyboard input
- **useApp**: Access app lifecycle (exit, etc.)
- **useStdin/useStdout**: Raw stdin/stdout access
- **useFocus/useFocusManager**: Focus management for interactive elements

See [hooks.md](references/hooks.md) for detailed documentation.

### 3. Layout System

Ink uses Flexbox via Yoga:

- All elements are Flexbox containers by default
- Supports `flexDirection`, `justifyContent`, `alignItems`
- Width/height can be numbers (columns/rows) or percentages
- Margins and padding work like CSS

See [layouts.md](references/layouts.md) for common patterns.

## Development Workflow

### 1. Entry Point (cli.tsx)

```tsx
#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app.js';

render(<App />);
```

### 2. Main Component (app.tsx)

```tsx
import React from 'react';
import {Text} from 'ink';

export default function App() {
	return <Text>Hello from Ink!</Text>;
}
```

### 3. Build Configuration

**TypeScript (tsconfig.json)**:

```json
{
	"compilerOptions": {
		"module": "Node16",
		"target": "ES2022",
		"lib": ["ES2022"],
		"moduleResolution": "Node16",
		"esModuleInterop": true,
		"strict": true,
		"outDir": "dist",
		"jsx": "react-jsx"
	}
}
```

**package.json**:

```json
{
	"type": "module",
	"bin": "dist/cli.js",
	"scripts": {
		"build": "tsc",
		"dev": "tsc --watch",
		"start": "node dist/cli.js"
	}
}
```

## Testing

Ink applications can be tested using `ink-testing-library`:

```bash
npm install --save-dev ink-testing-library
```

See [testing.md](references/testing.md) for testing patterns and examples.

## Common Patterns

- **Forms**: Input handling with validation
- **Menus**: Selection interfaces with arrow key navigation
- **Wizards**: Multi-step flows with state management
- **Progress**: Loading states and progress bars
- **Dashboards**: Real-time data layouts

See [patterns.md](references/patterns.md) for implementation examples.

## Additional Resources

- [components.md](references/components.md) - Component reference
- [hooks.md](references/hooks.md) - Hook documentation
- [testing.md](references/testing.md) - Testing strategies
- [layouts.md](references/layouts.md) - Layout patterns
- [patterns.md](references/patterns.md) - Common UI patterns
- [examples/](examples/) - Working code examples

## Best Practices

1. **Prefer function components** - Ink works best with functional components and hooks
2. **Use Flexbox for layouts** - Leverage Box properties for responsive designs
3. **Handle cleanup** - Use React's `useEffect` cleanup for timers and intervals
4. **Test interactive components** - Use ink-testing-library for reliable tests
5. **Consider terminal limitations** - Not all terminals support all colors or Unicode
6. **Exit gracefully** - Always call `exit()` from `useApp()` when done

## Troubleshooting

**Nothing renders**: Ensure you're calling `render()` at the end of your script

**Input not working**: Make sure you're using `useInput` hook inside a component rendered by Ink

**Layout issues**: Remember every element is a Flexbox container by default

**TypeScript errors**: Ensure you're using `"jsx": "react-jsx"` in tsconfig.json

## External Resources

- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Ink Documentation](https://github.com/vadimdemedes/ink#readme)
- [create-ink-app](https://github.com/vadimdemedes/create-ink-app) - Project scaffolding
