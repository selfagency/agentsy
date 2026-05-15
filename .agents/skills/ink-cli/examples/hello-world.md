# Hello World Example

Basic Ink CLI application structure.

## Complete Example

**package.json:**

```json
{
	"name": "hello-ink",
	"version": "1.0.0",
	"type": "module",
	"bin": "dist/cli.js",
	"scripts": {
		"build": "tsc",
		"dev": "tsc --watch",
		"start": "node dist/cli.js"
	},
	"dependencies": {
		"ink": "^4.1.0",
		"react": "^18.2.0"
	},
	"devDependencies": {
		"@types/react": "^18.0.32",
		"typescript": "^5.0.0"
	}
}
```

**tsconfig.json:**

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "Node16",
		"lib": ["ES2022"],
		"moduleResolution": "Node16",
		"esModuleInterop": true,
		"strict": true,
		"outDir": "dist",
		"rootDir": "source",
		"jsx": "react-jsx",
		"skipLibCheck": true
	},
	"include": ["source"]
}
```

**source/cli.tsx:**

```tsx
#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app.js';

render(<App />);
```

**source/app.tsx:**

```tsx
import React from 'react';
import {Box, Text} from 'ink';

export default function App() {
	return (
		<Box>
			<Text color="green">Hello, World!</Text>
		</Box>
	);
}
```

## Running

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start

# Or run directly
node dist/cli.js
```

## Development Mode

```bash
# Watch mode - rebuilds on file changes
npm run dev

# In another terminal
npm start
```

## Colored Output

```tsx
import {Text} from 'ink';

// Foreground colors
<Text color="red">Red text</Text>
<Text color="#ff0000">Hex color</Text>
<Text color="rgb(255, 0, 0)">RGB color</Text>

// Background colors
<Text backgroundColor="blue">Blue background</Text>

// Text styles
<Text bold>Bold</Text>
<Text italic>Italic</Text>
<Text underline>Underlined</Text>
```

## Interactive Exit

Add keyboard handling to exit the app:

```tsx
import {useInput, useApp} from 'ink';

function App() {
	const {exit} = useApp();

	useInput((input, key) => {
		if (input === 'q' || (key.ctrl && input === 'c')) {
			exit();
		}
	});

	return <Text>Press 'q' to quit</Text>;
}
```

## Simple Counter

Demonstrating state updates:

```tsx
import React, {useState, useEffect} from 'react';
import {Text} from 'ink';

function App() {
	const [count, setCount] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setCount(c => c + 1);
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	return <Text>Count: {count}</Text>;
}
```

## Running with Arguments

Using `meow` for CLI arguments:

```bash
npm install meow
```

```tsx
import meow from 'meow';

const cli = meow(
	`
  Usage
    $ hello-ink

  Options
    --name  Your name

  Examples
    $ hello-ink --name=John
`,
	{
		importMeta: import.meta,
		flags: {
			name: {
				type: 'string',
				default: 'World',
			},
		},
	},
);

render(<App name={cli.flags.name} />);
```

```tsx
interface AppProps {
	name: string;
}

export default function App({name}: AppProps) {
	return <Text>Hello, {name}!</Text>;
}
```
