# Common CLI Patterns with Ink

Reusable patterns for building common CLI interface elements.

## Menu Selection

A selectable list with arrow key navigation.

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface MenuProps {
  items: string[];
  onSelect: (item: string) => void;
}

function Menu({ items, onSelect }: MenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : items.length - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((i) => (i < items.length - 1 ? i + 1 : 0));
    }
    if (key.return) {
      onSelect(items[selectedIndex]);
    }
  });

  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <Box key={item}>
          <Text
            color={selectedIndex === index ? "green" : "white"}
            bold={selectedIndex === index}
          >
            {selectedIndex === index ? "> " : "  "}
            {item}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

### Usage

```tsx
<Menu
  items={["New Project", "Open Project", "Settings", "Quit"]}
  onSelect={(item) => console.log(`Selected: ${item}`)}
/>
```

## Text Input

Basic text input with backspace support.

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  mask?: string;
}

function TextInput({
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
  mask,
}: TextInputProps) {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  useInput((input, key) => {
    if (key.return && onSubmit) {
      onSubmit(value);
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue =
          value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition((p) => p - 1);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition((p) => Math.max(0, p - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition((p) => Math.min(value.length, p + 1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const newValue =
        value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition((p) => p + 1);
    }
  });

  const displayValue = mask ? mask.repeat(value.length) : value;
  const showPlaceholder = !value && placeholder;

  return (
    <Box>
      <Text bold>{label}: </Text>
      <Box borderStyle="single" paddingX={1}>
        <Text dimColor={showPlaceholder}>
          {showPlaceholder ? placeholder : displayValue}
        </Text>
        <Text color="green">|</Text>
      </Box>
    </Box>
  );
}
```

### Usage

```tsx
const [name, setName] = useState("");

<TextInput
  label="Name"
  value={name}
  onChange={setName}
  onSubmit={(value) => console.log(`Hello, ${value}!`)}
  placeholder="Enter your name"
/>;
```

## Progress Bar

Visual progress indicator.

```tsx
import React from "react";
import { Box, Text } from "ink";

interface ProgressBarProps {
  percent: number;
  width?: number;
  character?: string;
  color?: string;
}

function ProgressBar({
  percent,
  width = 40,
  character = "█",
  color = "green",
}: ProgressBarProps) {
  const filled = Math.floor((percent / 100) * width);
  const empty = width - filled;

  return (
    <Box>
      <Text color={color}>{character.repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
      <Text> {percent.toFixed(0)}%</Text>
    </Box>
  );
}
```

### Animated Progress Example

```tsx
import { useState, useEffect } from "react";

function AnimatedProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + 1;
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return <ProgressBar percent={progress} />;
}
```

## Spinner/Loading

Animated loading indicator.

```tsx
import React, { useState, useEffect } from "react";
import { Text } from "ink";

function Spinner({ text = "Loading" }: { text?: string }) {
  const [frame, setFrame] = useState(0);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 80);

    return () => clearInterval(timer);
  }, []);

  return (
    <Text>
      <Text color="green">{frames[frame]}</Text> {text}...
    </Text>
  );
}
```

### Usage

```tsx
{
  isLoading && <Spinner text="Fetching data" />;
}
```

## Multi-Step Wizard

Guided multi-step form flow.

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface WizardStep {
  id: string;
  title: string;
  component: React.ComponentType<{ onNext: () => void; onBack?: () => void }>;
}

interface WizardProps {
  steps: WizardStep[];
  onComplete: (data: Record<string, any>) => void;
}

function Wizard({ steps, onComplete }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Record<string, any>>({});

  const handleNext = (stepData?: any) => {
    if (stepData) {
      setData((d) => ({ ...d, [steps[currentStep].id]: stepData }));
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onComplete({ ...data, [steps[currentStep].id]: stepData });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const StepComponent = steps[currentStep].component;

  return (
    <Box flexDirection="column">
      {/* Progress */}
      <Box marginBottom={1}>
        <Text dimColor>
          Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
        </Text>
      </Box>

      {/* Step content */}
      <StepComponent
        onNext={handleNext}
        onBack={currentStep > 0 ? handleBack : undefined}
      />

      {/* Navigation help */}
      <Box marginTop={1}>
        <Text dimColor>
          {currentStep > 0 && "← Back  "}
          Enter → Next
        </Text>
      </Box>
    </Box>
  );
}
```

### Usage

```tsx
const steps = [
  {
    id: "name",
    title: "Project Name",
    component: ({ onNext }) => <TextInput label="Name" onSubmit={onNext} />,
  },
  {
    id: "type",
    title: "Project Type",
    component: ({ onNext }) => (
      <Menu items={["Web App", "CLI Tool", "Library"]} onSelect={onNext} />
    ),
  },
];

<Wizard steps={steps} onComplete={(data) => console.log("Created:", data)} />;
```

## Confirmation Dialog

Yes/No confirmation prompt.

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface ConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function Confirm({ message, onConfirm, onCancel }: ConfirmProps) {
  const [selected, setSelected] = useState<"yes" | "no">("yes");

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow) {
      setSelected((s) => (s === "yes" ? "no" : "yes"));
    }
    if (key.return) {
      if (selected === "yes") {
        onConfirm();
      } else {
        onCancel();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text>{message}</Text>
      <Box marginTop={1} gap={2}>
        <Text
          backgroundColor={selected === "yes" ? "green" : undefined}
          color={selected === "yes" ? "black" : "white"}
        >
          {" Yes "}
        </Text>
        <Text
          backgroundColor={selected === "no" ? "red" : undefined}
          color={selected === "no" ? "black" : "white"}
        >
          {" No "}
        </Text>
      </Box>
    </Box>
  );
}
```

## Status Indicators

Visual status badges.

```tsx
import React from "react";
import { Text } from "ink";

type StatusType = "success" | "error" | "warning" | "info" | "pending";

interface StatusProps {
  type: StatusType;
  text: string;
}

const statusConfig: Record<StatusType, { icon: string; color: string }> = {
  success: { icon: "✓", color: "green" },
  error: { icon: "✗", color: "red" },
  warning: { icon: "⚠", color: "yellow" },
  info: { icon: "ℹ", color: "blue" },
  pending: { icon: "○", color: "gray" },
};

function Status({ type, text }: StatusProps) {
  const config = statusConfig[type];
  return (
    <Text>
      <Text color={config.color}>{config.icon}</Text> {text}
    </Text>
  );
}
```

### Usage

```tsx
<Status type="success" text="Build completed" />
<Status type="error" text="Tests failed" />
<Status type="pending" text="Deploying..." />
```

## Log Output

Scrollable log output with timestamps.

```tsx
import React, { useState, useEffect } from "react";
import { Static, Text } from "ink";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error";
  message: string;
}

function LogOutput({ entries }: { entries: LogEntry[] }) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "red";
      case "warn":
        return "yellow";
      default:
        return "white";
    }
  };

  return (
    <Static items={entries}>
      {(entry) => (
        <Text key={entry.id}>
          <Text dimColor>[{formatTime(entry.timestamp)}]</Text>{" "}
          <Text color={getLevelColor(entry.level)}>
            {entry.level.toUpperCase()}
          </Text>{" "}
          {entry.message}
        </Text>
      )}
    </Static>
  );
}
```

## Error Boundary

Handle and display errors gracefully.

```tsx
import React, { Component, ReactNode } from "react";
import { Box, Text } from "ink";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="red"
          padding={1}
        >
          <Text bold color="red">
            Error
          </Text>
          <Text>{this.state.error?.message}</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
```

## Search/Filter

Searchable list with real-time filtering.

```tsx
import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";

interface SearchableListProps<T> {
  items: T[];
  renderItem: (item: T) => string;
  onSelect: (item: T) => void;
}

function SearchableList<T>({
  items,
  renderItem,
  onSelect,
}: SearchableListProps<T>) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = useMemo(() => {
    if (!query) return items;
    return items.filter((item) =>
      renderItem(item).toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query, renderItem]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(filteredItems.length - 1, i + 1));
    } else if (key.return) {
      onSelect(filteredItems[selectedIndex]);
    } else if (key.backspace) {
      setQuery((q) => q.slice(0, -1));
    } else if (input && !key.ctrl) {
      setQuery((q) => q + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1} marginBottom={1}>
        <Text>Search: {query}</Text>
        <Text color="green">|</Text>
      </Box>

      <Box flexDirection="column">
        {filteredItems.map((item, index) => (
          <Text
            key={index}
            color={selectedIndex === index ? "green" : "white"}
            bold={selectedIndex === index}
          >
            {selectedIndex === index ? "> " : "  "}
            {renderItem(item)}
          </Text>
        ))}
      </Box>

      {filteredItems.length === 0 && <Text dimColor>No results found</Text>}
    </Box>
  );
}
```

## Best Practices

1. **Always handle cleanup**: Clear intervals and timeouts in useEffect cleanup
2. **Debounce rapid updates**: For search/filter, debounce input to prevent lag
3. **Provide keyboard shortcuts**: Allow Ctrl+C for exit, arrows for navigation
4. **Show help text**: Display available keyboard shortcuts
5. **Validate input**: Check bounds before array access
6. **Use Static for logs**: Prevent unnecessary re-renders of append-only content
7. **Support cancellation**: Allow users to exit long-running operations
8. **Show loading states**: Always indicate when the app is working
