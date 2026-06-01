# Ink Hooks

Terminal-specific React hooks provided by Ink.

## useInput

Handle keyboard input. This hook listens for keyboard events and provides both the character input and key metadata.

```tsx
import { useInput } from "ink";

function App() {
  useInput((input, key) => {
    if (input === "q") {
      // Handle 'q' key
      console.log("Quit requested");
    }

    if (key.return) {
      // Handle Enter/Return key
      console.log("Enter pressed");
    }

    if (key.escape) {
      // Handle Escape key
      console.log("Escape pressed");
    }
  });

  return <Text>Press keys...</Text>;
}
```

### Parameters

```tsx
useInput(
  handler: (input: string, key: Key) => void,
  options?: Options
)
```

### Key Object

| Property     | Type      | Description      |
| ------------ | --------- | ---------------- |
| `return`     | `boolean` | Return/Enter key |
| `escape`     | `boolean` | Escape key       |
| `ctrl`       | `boolean` | Ctrl modifier    |
| `shift`      | `boolean` | Shift modifier   |
| `tab`        | `boolean` | Tab key          |
| `backspace`  | `boolean` | Backspace key    |
| `delete`     | `boolean` | Delete key       |
| `upArrow`    | `boolean` | Up arrow         |
| `downArrow`  | `boolean` | Down arrow       |
| `leftArrow`  | `boolean` | Left arrow       |
| `rightArrow` | `boolean` | Right arrow      |
| `pageUp`     | `boolean` | Page Up          |
| `pageDown`   | `boolean` | Page Down        |
| `home`       | `boolean` | Home key         |
| `end`        | `boolean` | End key          |
| `meta`       | `boolean` | Meta/Command key |

### Options

| Option     | Type      | Default | Description                 |
| ---------- | --------- | ------- | --------------------------- |
| `isActive` | `boolean` | `true`  | Whether to listen for input |

### Input String

The `input` parameter contains:

- Regular characters: `'a'`, `'1'`, `' '`
- Combined with shift: `'A'`, `'!'`
- Control characters as empty string (check `key.ctrl`)

### Examples

```tsx
// Arrow key navigation
useInput((input, key) => {
  if (key.upArrow) setIndex((i) => i - 1);
  if (key.downArrow) setIndex((i) => i + 1);
});

// Ctrl+C handling
useInput((input, key) => {
  if (key.ctrl && input === "c") {
    process.exit(0);
  }
});

// Conditional input handling
useInput(
  (input, key) => {
    if (isActive) {
      // Handle input only when active
    }
  },
  { isActive }
);
```

## useApp

Access the Ink app instance for lifecycle control.

```tsx
import { useApp } from "ink";

function App() {
  const { exit, waitUntilExit } = useApp();

  const handleQuit = () => {
    exit(); // Exit the app
  };

  return <Text onPress={handleQuit}>Press to quit</Text>;
}
```

### Returns

| Property        | Type                      | Description                          |
| --------------- | ------------------------- | ------------------------------------ |
| `exit`          | `(error?: Error) => void` | Exit the application                 |
| `waitUntilExit` | `() => Promise<void>`     | Promise that resolves when app exits |

### Usage Patterns

```tsx
// Graceful exit
const { exit } = useApp();
exit(); // Clean exit

// Exit with error
exit(new Error("Something went wrong"));

// Wait for exit
const { waitUntilExit } = useApp();
await waitUntilExit();
```

## useStdin

Access raw stdin stream and control raw mode.

```tsx
import { useStdin } from "ink";

function App() {
  const { stdin, setRawMode, isRawModeSupported } = useStdin();

  useEffect(() => {
    if (isRawModeSupported) {
      setRawMode(true);

      const handleData = (data: Buffer) => {
        // Handle raw input data
      };

      stdin.on("data", handleData);

      return () => {
        stdin.off("data", handleData);
        setRawMode(false);
      };
    }
  }, []);

  return <Text>Reading raw stdin</Text>;
}
```

### Returns

| Property             | Type                         | Description                   |
| -------------------- | ---------------------------- | ----------------------------- |
| `stdin`              | `NodeJS.ReadStream`          | Raw stdin stream              |
| `setRawMode`         | `(rawMode: boolean) => void` | Enable/disable raw mode       |
| `isRawModeSupported` | `boolean`                    | Whether raw mode is supported |

### Important Notes

- Raw mode is required for individual key detection
- Always clean up event listeners in useEffect cleanup
- Not all environments support raw mode (e.g., CI environments)

## useStdout

Access stdout stream for direct output.

```tsx
import { useStdout } from "ink";

function App() {
  const { stdout, write } = useStdout();

  useEffect(() => {
    // Get terminal dimensions
    const { columns, rows } = stdout;
    console.log(`Terminal: ${columns}x${rows}`);
  }, []);

  return <Text>Check console for dimensions</Text>;
}
```

### Returns

| Property | Type                     | Description              |
| -------- | ------------------------ | ------------------------ |
| `stdout` | `NodeJS.WriteStream`     | Raw stdout stream        |
| `write`  | `(data: string) => void` | Write directly to stdout |

## useStderr

Access stderr stream for error output.

```tsx
import { useStderr } from "ink";

function App() {
  const { stderr, write } = useStderr();

  const logError = (message: string) => {
    write(`Error: ${message}\n`);
  };

  return <Text>Errors logged to stderr</Text>;
}
```

### Returns

| Property | Type                     | Description              |
| -------- | ------------------------ | ------------------------ |
| `stderr` | `NodeJS.WriteStream`     | Raw stderr stream        |
| `write`  | `(data: string) => void` | Write directly to stderr |

## useFocus

Manage focus for interactive components.

```tsx
import { useFocus } from "ink";

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  const { isFocused } = useFocus();

  return (
    <Text bold={isFocused} color={isFocused ? "green" : "white"}>
      {isFocused ? "> " : "  "}
      {label}
    </Text>
  );
}
```

### Parameters

```tsx
useFocus(options?: Options)
```

### Options

| Option      | Type      | Default        | Description                              |
| ----------- | --------- | -------------- | ---------------------------------------- |
| `isActive`  | `boolean` | `true`         | Whether this component can receive focus |
| `autoFocus` | `boolean` | `false`        | Auto-focus on mount                      |
| `id`        | `string`  | auto-generated | Focus identifier                         |

### Returns

| Property    | Type      | Description                      |
| ----------- | --------- | -------------------------------- |
| `isFocused` | `boolean` | Whether this component has focus |

### Usage Pattern

```tsx
function Menu() {
  return (
    <Box flexDirection="column">
      <Button label="Option 1" />
      <Button label="Option 2" />
      <Button label="Option 3" />
    </Box>
  );
}
```

## useFocusManager

Programmatically manage focus across components.

```tsx
import { useFocusManager } from "ink";

function App() {
  const { focusNext, focusPrevious, focus } = useFocusManager();

  useInput((input, key) => {
    if (key.tab) {
      if (key.shift) {
        focusPrevious();
      } else {
        focusNext();
      }
    }
  });

  return (
    <Box>
      <Input id="input1" />
      <Input id="input2" />
      <Input id="input3" />
    </Box>
  );
}
```

### Returns

| Method          | Type                   | Description                      |
| --------------- | ---------------------- | -------------------------------- |
| `focus`         | `(id: string) => void` | Focus a specific component by ID |
| `focusNext`     | `() => void`           | Focus the next component         |
| `focusPrevious` | `() => void`           | Focus the previous component     |

### Complete Example

```tsx
import React, { useState } from "react";
import { Box, Text, useInput, useFocus, useFocusManager } from "ink";

function FocusableInput({ id, label }: { id: string; label: string }) {
  const { isFocused } = useFocus({ id });
  const [value, setValue] = useState("");

  useInput((input) => {
    if (isFocused) {
      setValue((v) => v + input);
    }
  });

  return (
    <Box>
      <Text color={isFocused ? "green" : "gray"}>
        {isFocused ? "> " : "  "}
        {label}: {value}
      </Text>
    </Box>
  );
}

function App() {
  const { focusNext, focusPrevious } = useFocusManager();

  useInput((input, key) => {
    if (key.tab) {
      key.shift ? focusPrevious() : focusNext();
    }
  });

  return (
    <Box flexDirection="column">
      <FocusableInput id="name" label="Name" />
      <FocusableInput id="email" label="Email" />
      <FocusableInput id="phone" label="Phone" />
    </Box>
  );
}
```

## useCursor

Control cursor visibility (experimental).

```tsx
import { useCursor } from "ink";

function App() {
  const { showCursor, hideCursor } = useCursor();

  useEffect(() => {
    hideCursor();
    return () => showCursor();
  }, []);

  return <Text>Cursor is hidden</Text>;
}
```

### Returns

| Method       | Type         | Description              |
| ------------ | ------------ | ------------------------ |
| `showCursor` | `() => void` | Show the terminal cursor |
| `hideCursor` | `() => void` | Hide the terminal cursor |

### Notes

- Always show cursor in cleanup to avoid leaving terminal in bad state
- Useful for full-screen applications
- May not work in all terminal emulators

## Hook Combinations

### Common Patterns

**Exit on Ctrl+C:**

```tsx
const { exit } = useApp();

useInput((input, key) => {
  if (key.ctrl && input === "c") {
    exit();
  }
});
```

**Navigation with Arrows:**

```tsx
const [selectedIndex, setSelectedIndex] = useState(0);
const items = ["Item 1", "Item 2", "Item 3"];

useInput((input, key) => {
  if (key.upArrow) {
    setSelectedIndex((i) => Math.max(0, i - 1));
  }
  if (key.downArrow) {
    setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
  }
});
```

**Form Tab Navigation:**

```tsx
const { focusNext, focusPrevious } = useFocusManager();

useInput((input, key) => {
  if (key.tab) {
    if (key.shift) {
      focusPrevious();
    } else {
      focusNext();
    }
  }
});
```

**Terminal Resize Handling:**

```tsx
const { stdout } = useStdout();

useEffect(() => {
  const handleResize = () => {
    console.log(`Resized: ${stdout.columns}x${stdout.rows}`);
  };

  stdout.on("resize", handleResize);
  return () => stdout.off("resize", handleResize);
}, []);
```
