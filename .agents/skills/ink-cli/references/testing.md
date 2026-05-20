# Testing Ink Applications

Test Ink CLI applications using ink-testing-library.

## Installation

```bash
npm install --save-dev ink-testing-library
```

## Basic Setup

```tsx
import test from "node:test";
import assert from "node:assert";
import React from "react";
import { render } from "ink-testing-library";
import App from "./app.js";

test("app renders", () => {
  const { lastFrame } = render(<App />);
  assert.ok(lastFrame().includes("Hello"));
});
```

## render() Function

The `render` function creates a test instance of your Ink app.

```tsx
const instance = render(<MyComponent />);
```

### Returns

| Property    | Type                                         | Description                  |
| ----------- | -------------------------------------------- | ---------------------------- |
| `lastFrame` | `() => string`                               | Get the last rendered output |
| `frames`    | `string[]`                                   | Array of all rendered frames |
| `stdin`     | `{write: (data: string) => void, ...}`       | Simulate stdin input         |
| `unmount`   | `() => void`                                 | Unmount the component        |
| `rerender`  | `(tree: ReactElement) => void`               | Re-render with new props     |
| `waitFor`   | `(expectation: () => void) => Promise<void>` | Wait for condition           |

## Testing Output

### lastFrame()

Get the current terminal output as a string.

```tsx
const { lastFrame } = render(<Text color="green">Success</Text>);
const output = lastFrame();

// Output contains ANSI codes
console.log(output); // "\u001b[32mSuccess\u001b[39m"

// Strip ANSI codes for plain text comparison
const stripAnsi = (str: string) => str.replace(/\u001b\[\d+m/g, "");
assert.strictEqual(stripAnsi(output), "Success");
```

### frames

Access all rendered frames (useful for animation testing).

```tsx
const { frames } = render(<Counter />);

// Check progression of frames
assert.ok(frames[0].includes("0"));
assert.ok(frames[1].includes("1"));
assert.ok(frames[2].includes("2"));
```

## Testing User Input

Simulate keyboard input using the `stdin` object.

```tsx
const { lastFrame, stdin } = render(<InputForm />);

// Simulate typing
stdin.write("hello");
assert.ok(lastFrame().includes("hello"));

// Simulate special keys
stdin.write("\r"); // Enter/Return
stdin.write("\u0003"); // Ctrl+C
stdin.write("\u001b"); // Escape
```

### Common Key Codes

| Key         | Code         |
| ----------- | ------------ |
| Enter       | `\r` or `\n` |
| Escape      | `\u001b`     |
| Ctrl+C      | `\u0003`     |
| Backspace   | `\u007f`     |
| Tab         | `\t`         |
| Up Arrow    | `\u001b[A`   |
| Down Arrow  | `\u001b[B`   |
| Right Arrow | `\u001b[C`   |
| Left Arrow  | `\u001b[D`   |

### Testing Arrow Navigation

```tsx
test("menu navigation", () => {
  const { lastFrame, stdin } = render(<Menu items={["A", "B", "C"]} />);

  // Initial state
  assert.ok(lastFrame().includes("> A"));

  // Navigate down
  stdin.write("\u001b[B"); // Down arrow
  assert.ok(lastFrame().includes("> B"));

  // Navigate down again
  stdin.write("\u001b[B");
  assert.ok(lastFrame().includes("> C"));
});
```

## Async Testing

Test asynchronous behavior with `waitFor`.

```tsx
test("loading state", async () => {
  const { lastFrame, waitFor } = render(<DataFetcher />);

  // Initial loading state
  assert.ok(lastFrame().includes("Loading"));

  // Wait for data to load
  await waitFor(() => {
    assert.ok(lastFrame().includes("Data loaded"));
  });
});
```

### waitFor Options

```tsx
await waitFor(expectation, {
  timeout: 5000, // Max wait time in ms (default: 4500)
  interval: 50, // Check interval in ms (default: 50)
});
```

## Cleanup

Always unmount components after tests to prevent memory leaks.

```tsx
test("component", () => {
  const { lastFrame, unmount } = render(<App />);

  // Test assertions
  assert.ok(lastFrame().includes("Hello"));

  // Cleanup
  unmount();
});
```

Or use a test setup helper:

```tsx
let instance: ReturnType<typeof render>;

afterEach(() => {
  instance?.unmount();
});

test("example", () => {
  instance = render(<App />);
  // ... test code
});
```

## Testing Patterns

### Component with State

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

function Counter() {
  const [count, setCount] = useState(0);

  useInput((input) => {
    if (input === "+") setCount((c) => c + 1);
    if (input === "-") setCount((c) => c - 1);
  });

  return (
    <Box>
      <Text>Count: {count}</Text>
    </Box>
  );
}

// Test
test("counter increments and decrements", () => {
  const { lastFrame, stdin } = render(<Counter />);

  assert.ok(lastFrame().includes("Count: 0"));

  stdin.write("+");
  assert.ok(lastFrame().includes("Count: 1"));

  stdin.write("+");
  assert.ok(lastFrame().includes("Count: 2"));

  stdin.write("-");
  assert.ok(lastFrame().includes("Count: 1"));
});
```

### Testing Focus Management

```tsx
test("focus navigation", () => {
  const { lastFrame, stdin } = render(<Form />);

  // First input should be focused
  assert.ok(lastFrame().includes("> Name"));

  // Tab to next input
  stdin.write("\t");
  assert.ok(lastFrame().includes("> Email"));

  // Tab to next
  stdin.write("\t");
  assert.ok(lastFrame().includes("> Phone"));

  // Shift+Tab back
  stdin.write("\u001b[Z"); // Shift+Tab
  assert.ok(lastFrame().includes("> Email"));
});
```

### Testing Exit Behavior

```tsx
test("app exits on q", () => {
  let exited = false;

  function App() {
    const { exit } = useApp();

    useInput((input) => {
      if (input === "q") {
        exited = true;
        exit();
      }
    });

    return <Text>Press q to quit</Text>;
  }

  const { stdin } = render(<App />);
  stdin.write("q");

  assert.strictEqual(exited, true);
});
```

## Snapshot Testing

Use snapshots for complex UI testing.

```tsx
import { render } from "ink-testing-library";

test("UI snapshot", () => {
  const { lastFrame } = render(<ComplexLayout />);
  expect(lastFrame()).toMatchSnapshot();
});
```

## Mocking

### Mock useStdout

```tsx
const mockStdout = {
  columns: 80,
  rows: 24,
  on: () => {},
  off: () => {},
  write: () => {},
};

jest.mock("ink", () => ({
  ...jest.requireActual("ink"),
  useStdout: () => ({ stdout: mockStdout }),
}));
```

### Mock Terminal Size

```tsx
test("responsive layout", () => {
  // Simulate narrow terminal
  const narrowStdout = { ...mockStdout, columns: 40 };
  jest.spyOn(ink, "useStdout").mockReturnValue({ stdout: narrowStdout });

  const { lastFrame } = render(<ResponsiveLayout />);
  // Assert narrow layout

  // Simulate wide terminal
  const wideStdout = { ...mockStdout, columns: 120 };
  jest.spyOn(ink, "useStdout").mockReturnValue({ stdout: wideStdout });

  rerender(<ResponsiveLayout />);
  // Assert wide layout
});
```

## Test Utilities

### Helper: stripAnsi

```tsx
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[\d+m/g, "");
}

// Usage
const { lastFrame } = render(<ColoredText />);
assert.strictEqual(stripAnsi(lastFrame()), "Plain text");
```

### Helper: waitForFrame

```tsx
async function waitForFrame(
  condition: (frame: string) => boolean,
  { lastFrame, waitFor }: ReturnType<typeof render>
) {
  await waitFor(() => {
    if (!condition(lastFrame())) {
      throw new Error("Condition not met");
    }
  });
}

// Usage
await waitForFrame((frame) => frame.includes("Loaded"), instance);
```

### Helper: pressKey

```tsx
function pressKey(stdin: { write: (data: string) => void }, key: string) {
  const keyMap: Record<string, string> = {
    enter: "\r",
    escape: "\u001b",
    tab: "\t",
    up: "\u001b[A",
    down: "\u001b[B",
    right: "\u001b[C",
    left: "\u001b[D",
    backspace: "\u007f",
  };

  stdin.write(keyMap[key] || key);
}

// Usage
pressKey(stdin, "enter");
pressKey(stdin, "down");
pressKey(stdin, "q");
```

## Common Issues

### Issue: Tests hang

**Solution**: Always unmount components and clear timers.

```tsx
afterEach(() => {
  jest.clearAllTimers();
});
```

### Issue: ANSI codes in assertions

**Solution**: Strip ANSI codes or use regex matching.

```tsx
// Instead of
assert.strictEqual(lastFrame(), "Hello");

// Use
assert.ok(lastFrame().includes("Hello"));
// or
assert.strictEqual(stripAnsi(lastFrame()), "Hello");
```

### Issue: Async tests timeout

**Solution**: Increase timeout or check for infinite loops.

```tsx
test("slow operation", { timeout: 10000 }, async () => {
  const { waitFor } = render(<SlowComponent />);
  await waitFor(() => assert.ok(lastFrame().includes("Done")));
});
```

## Best Practices

1. **Clean up after tests**: Always call `unmount()`
2. **Strip ANSI codes**: For readable assertions, remove color codes
3. **Test behavior**: Focus on user interactions, not implementation
4. **Use waitFor**: For async operations, avoid arbitrary timeouts
5. **Mock external dependencies**: API calls, file system, etc.
6. **Test edge cases**: Empty states, errors, boundary conditions
