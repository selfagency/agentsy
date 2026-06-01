# Input Handling Example

Comprehensive keyboard input handling patterns.

## Basic Input

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

function InputDemo() {
  const [lastKey, setLastKey] = useState("");

  useInput((input, key) => {
    setLastKey(`Input: "${input}", Key: ${JSON.stringify(key)}`);
  });

  return (
    <Box flexDirection="column">
      <Text>Press any key...</Text>
      <Text color="green">{lastKey}</Text>
    </Box>
  );
}
```

## Arrow Key Navigation

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

function ArrowNavigation() {
  const [position, setPosition] = useState({ x: 10, y: 5 });

  useInput((input, key) => {
    if (key.upArrow) {
      setPosition((p) => ({ ...p, y: Math.max(0, p.y - 1) }));
    }
    if (key.downArrow) {
      setPosition((p) => ({ ...p, y: p.y + 1 }));
    }
    if (key.leftArrow) {
      setPosition((p) => ({ ...p, x: Math.max(0, p.x - 1) }));
    }
    if (key.rightArrow) {
      setPosition((p) => ({ ...p, x: p.x + 1 }));
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Use arrow keys to move</Text>
      <Text>
        Position: ({position.x}, {position.y})
      </Text>
    </Box>
  );
}
```

## Character Input

Building a text input from scratch:

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

function TextInput() {
  const [text, setText] = useState("");

  useInput((input, key) => {
    if (key.return) {
      console.log("Submitted:", text);
      return;
    }

    if (key.backspace) {
      setText((t) => t.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setText((t) => t + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Type something (Enter to submit):</Text>
      <Box borderStyle="single" paddingX={1} minWidth={20}>
        <Text>{text || " "}</Text>
        <Text color="green">|</Text>
      </Box>
    </Box>
  );
}
```

## Menu with Selection

```tsx
import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";

interface MenuItem {
  id: string;
  label: string;
}

function Menu({ items }: { items: MenuItem[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : items.length - 1));
    }

    if (key.downArrow) {
      setSelectedIndex((i) => (i < items.length - 1 ? i + 1 : 0));
    }

    if (key.return) {
      const selected = items[selectedIndex];
      console.log("Selected:", selected.label);
      exit();
    }

    if (input === "q") {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Menu (Use arrows, Enter to select, q to quit):</Text>
      <Newline />

      {items.map((item, index) => (
        <Box key={item.id}>
          <Text
            color={selectedIndex === index ? "green" : "white"}
            bold={selectedIndex === index}
          >
            {selectedIndex === index ? "→ " : "  "}
            {item.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// Usage
const items = [
  { id: "1", label: "Option 1" },
  { id: "2", label: "Option 2" },
  { id: "3", label: "Option 3" },
];

<Menu items={items} />;
```

## Multi-Key Shortcuts

Handling keyboard shortcuts:

```tsx
import React from "react";
import { Box, Text, useInput, useApp } from "ink";

function ShortcutsDemo() {
  const { exit } = useApp();

  useInput((input, key) => {
    // Ctrl+C to exit
    if (key.ctrl && input === "c") {
      exit();
    }

    // Ctrl+S to save
    if (key.ctrl && input === "s") {
      console.log("Saving...");
      return;
    }

    // Ctrl+R to refresh
    if (key.ctrl && input === "r") {
      console.log("Refreshing...");
      return;
    }

    // Simple key shortcuts
    switch (input) {
      case "q":
        exit();
        break;
      case "h":
        console.log("Help: q=quit, s=status, r=reload");
        break;
      case "s":
        console.log("Status: OK");
        break;
      case "r":
        console.log("Reloading...");
        break;
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Keyboard Shortcuts Demo</Text>
      <Newline />
      <Text>q - Quit</Text>
      <Text>h - Help</Text>
      <Text>s - Status</Text>
      <Text>r - Reload</Text>
      <Text>Ctrl+C - Force quit</Text>
      <Text>Ctrl+S - Save</Text>
      <Text>Ctrl+R - Refresh</Text>
    </Box>
  );
}
```

## Form with Tab Navigation

```tsx
import React, { useState } from "react";
import { Box, Text, useInput, useFocus, useFocusManager } from "ink";

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { isFocused } = useFocus();

  useInput((input) => {
    if (isFocused) {
      if (input === "\x7F") {
        // Backspace
        onChange(value.slice(0, -1));
      } else if (input >= " " && input <= "~") {
        // Printable characters
        onChange(value + input);
      }
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold={isFocused} color={isFocused ? "green" : "white"}>
        {label}:
      </Text>
      <Box
        borderStyle={isFocused ? "double" : "single"}
        borderColor={isFocused ? "green" : "white"}
        paddingX={1}
        width={40}
      >
        <Text>{value || " "}</Text>
      </Box>
    </Box>
  );
}

function Form() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

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

  const updateField = (field: keyof typeof formData) => (value: string) => {
    setFormData((d) => ({ ...d, [field]: value }));
  };

  return (
    <Box flexDirection="column">
      <Text bold>Form (Tab to navigate):</Text>
      <Newline />

      <FormField
        label="Name"
        value={formData.name}
        onChange={updateField("name")}
      />

      <FormField
        label="Email"
        value={formData.email}
        onChange={updateField("email")}
      />

      <FormField
        label="Phone"
        value={formData.phone}
        onChange={updateField("phone")}
      />

      <Newline />
      <Text dimColor>Current values: {JSON.stringify(formData)}</Text>
    </Box>
  );
}
```

## Real-Time Search

```tsx
import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";

function SearchableList({ items }: { items: string[] }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = useMemo(() => {
    if (!query) return items;
    return items.filter((item) =>
      item.toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(filteredItems.length - 1, i + 1));
    } else if (key.backspace) {
      setQuery((q) => q.slice(0, -1));
      setSelectedIndex(0);
    } else if (input && !key.ctrl) {
      setQuery((q) => q + input);
      setSelectedIndex(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1} marginBottom={1}>
        <Text>Search: {query}</Text>
        <Text color="green">|</Text>
      </Box>

      <Box flexDirection="column" height={10}>
        {filteredItems.slice(0, 10).map((item, index) => (
          <Text
            key={item}
            color={selectedIndex === index ? "green" : "white"}
            bold={selectedIndex === index}
          >
            {selectedIndex === index ? "> " : "  "}
            {item}
          </Text>
        ))}
      </Box>

      <Text dimColor>
        Showing {Math.min(10, filteredItems.length)} of {filteredItems.length}{" "}
        items
      </Text>
    </Box>
  );
}

// Usage
const items = [
  "Apple",
  "Banana",
  "Cherry",
  "Date",
  "Elderberry",
  "Fig",
  "Grape",
  "Honeydew",
];

<SearchableList items={items} />;
```

## Game Controls

Simple game input handling:

```tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";

function Game() {
  const { stdout } = useStdout();
  const [player, setPlayer] = useState({ x: 10, y: 10 });
  const [score, setScore] = useState(0);

  useInput((input, key) => {
    const speed = key.shift ? 2 : 1;

    if (key.upArrow) {
      setPlayer((p) => ({ ...p, y: Math.max(0, p.y - speed) }));
    }
    if (key.downArrow) {
      setPlayer((p) => ({ ...p, y: Math.min(stdout.rows - 1, p.y + speed) }));
    }
    if (key.leftArrow) {
      setPlayer((p) => ({ ...p, x: Math.max(0, p.x - speed) }));
    }
    if (key.rightArrow) {
      setPlayer((p) => ({
        ...p,
        x: Math.min(stdout.columns - 1, p.x + speed),
      }));
    }
    if (input === " ") {
      setScore((s) => s + 10);
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Score: {score}</Text>
      <Text>Use arrows to move, Space to score, Shift for speed boost</Text>
      <Newline />
      <Box height={player.y} />
      <Box width={player.x} />
      <Text color="green">●</Text>
    </Box>
  );
}
```
