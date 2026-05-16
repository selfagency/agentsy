# Layout Examples

Practical layout patterns for terminal applications.

## Dashboard Layout

```tsx
import React from "react";
import { Box, Text, useStdout } from "ink";

function Dashboard() {
  const { stdout } = useStdout();

  return (
    <Box width={stdout.columns} height={stdout.rows} flexDirection="column">
      {/* Header */}
      <Box height={3} borderStyle="single" paddingX={1}>
        <Text bold>System Dashboard</Text>
      </Box>

      {/* Main content area */}
      <Box flexGrow={1} flexDirection="row">
        {/* Sidebar */}
        <Box width={25} borderStyle="single" borderRight={false} padding={1}>
          <Text bold color="green">
            Navigation
          </Text>
          <Newline />
          <Text>Overview</Text>
          <Text>Metrics</Text>
          <Text>Logs</Text>
          <Text>Settings</Text>
        </Box>

        {/* Content */}
        <Box flexGrow={1} padding={2}>
          <Box flexDirection="column" gap={1}>
            {/* Stats row */}
            <Box flexDirection="row" gap={2}>
              <StatCard title="CPU" value="45%" color="yellow" />
              <StatCard title="Memory" value="2.3GB" color="green" />
              <StatCard title="Disk" value="120GB" color="blue" />
            </Box>

            {/* Chart area */}
            <Box flexGrow={1} borderStyle="single" padding={1}>
              <Text dimColor>Chart placeholder</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box height={1} paddingX={1}>
        <Text dimColor>Status: Online | Last update: 2s ago</Text>
      </Box>
    </Box>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <Box width="33%" borderStyle="round" borderColor={color} padding={1}>
      <Box flexDirection="column">
        <Text dimColor>{title}</Text>
        <Text bold color={color}>
          {value}
        </Text>
      </Box>
    </Box>
  );
}
```

## Chat Interface

```tsx
import React, { useState, useRef } from "react";
import { Box, Text, useStdout, Static } from "ink";

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
}

function ChatInterface() {
  const { stdout } = useStdout();
  const [messages] = useState<Message[]>([
    { id: "1", user: "Alice", text: "Hello!", timestamp: new Date() },
    { id: "2", user: "Bob", text: "Hi there!", timestamp: new Date() },
  ]);

  return (
    <Box width={stdout.columns} height={stdout.rows} flexDirection="column">
      {/* Messages area */}
      <Box flexGrow={1} flexDirection="column" padding={1}>
        <Static items={messages}>
          {(message) => (
            <Box key={message.id} marginBottom={1}>
              <Text color="green">{message.user}: </Text>
              <Text>{message.text}</Text>
            </Box>
          )}
        </Static>
      </Box>

      {/* Input area */}
      <Box height={3} borderStyle="single" paddingX={1}>
        <Text color="blue">&gt; </Text>
        <Text>Type your message...</Text>
        <Text color="green">|</Text>
      </Box>
    </Box>
  );
}
```

## File Browser

```tsx
import React, { useState } from "react";
import { Box, Text, useStdout } from "ink";

interface FileItem {
  name: string;
  type: "file" | "directory";
  size?: number;
}

function FileBrowser({ files }: { files: FileItem[] }) {
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <Box width={stdout.columns} height={stdout.rows} flexDirection="column">
      {/* Path bar */}
      <Box height={1} backgroundColor="blue" paddingX={1}>
        <Text color="white">/home/user/documents</Text>
      </Box>

      {/* File list */}
      <Box flexGrow={1} flexDirection="column">
        {files.map((file, index) => (
          <Box
            key={file.name}
            height={1}
            backgroundColor={selectedIndex === index ? "gray" : undefined}
          >
            <Box width={3}>
              <Text>{file.type === "directory" ? "📁" : "📄"}</Text>
            </Box>
            <Box width={40}>
              <Text>{file.name}</Text>
            </Box>
            <Box width={10}>
              <Text dimColor>
                {file.type === "file" ? formatSize(file.size) : "--"}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Status bar */}
      <Box height={1} backgroundColor="gray" paddingX={1}>
        <Text>
          {files.length} items | Selected: {files[selectedIndex]?.name}
        </Text>
      </Box>
    </Box>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
```

## Data Table

```tsx
import React from "react";
import { Box, Text } from "ink";

interface Column {
  key: string;
  header: string;
  width: number;
}

interface TableProps {
  columns: Column[];
  data: Record<string, string>[];
}

function Table({ columns, data }: TableProps) {
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box flexDirection="row" borderStyle="single" borderBottom>
        {columns.map((col) => (
          <Box key={col.key} width={col.width} paddingX={1}>
            <Text bold>{col.header}</Text>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {data.map((row, rowIndex) => (
        <Box
          key={rowIndex}
          flexDirection="row"
          backgroundColor={rowIndex % 2 === 0 ? undefined : "gray"}
        >
          {columns.map((col) => (
            <Box key={col.key} width={col.width} paddingX={1}>
              <Text>{row[col.key]}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

// Usage
const columns = [
  { key: "name", header: "Name", width: 20 },
  { key: "status", header: "Status", width: 15 },
  { key: "age", header: "Age", width: 10 },
];

const data = [
  { name: "Alice", status: "active", age: "30" },
  { name: "Bob", status: "inactive", age: "25" },
  { name: "Charlie", status: "active", age: "35" },
];

<Table columns={columns} data={data} />;
```

## Modal Dialog

```tsx
import React from "react";
import { Box, Text, useStdout } from "ink";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

function Modal({ title, children, onClose }: ModalProps) {
  const { stdout } = useStdout();
  const width = 60;
  const height = 15;

  const left = Math.floor((stdout.columns - width) / 2);
  const top = Math.floor((stdout.rows - height) / 2);

  return (
    <Box width={stdout.columns} height={stdout.rows}>
      {/* Overlay */}
      <Box width={stdout.columns} height={stdout.rows} flexDirection="column">
        {/* Top spacing */}
        <Box height={top} />

        {/* Modal container */}
        <Box flexDirection="row">
          <Box width={left} />

          {/* Modal */}
          <Box
            width={width}
            height={height}
            borderStyle="double"
            borderColor="white"
            flexDirection="column"
          >
            {/* Title */}
            <Box height={1} borderBottom paddingX={1}>
              <Text bold>{title}</Text>
            </Box>

            {/* Content */}
            <Box flexGrow={1} padding={1}>
              {children}
            </Box>

            {/* Footer */}
            <Box height={1} borderTop paddingX={1}>
              <Text dimColor>Press Escape to close</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// Usage
<Modal title="Confirm Action" onClose={() => {}}>
  <Text>Are you sure you want to proceed?</Text>
  <Box marginTop={1} gap={2}>
    <Text backgroundColor="green" color="black">
      {" "}
      Yes{" "}
    </Text>
    <Text backgroundColor="red" color="black">
      {" "}
      No{" "}
    </Text>
  </Box>
</Modal>;
```

## Split Pane

```tsx
import React, { useState } from "react";
import { Box, Text, useStdout } from "ink";

function SplitPane({
  left,
  right,
  initialSplit = 50,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  initialSplit?: number;
}) {
  const { stdout } = useStdout();
  const [splitPercent, setSplitPercent] = useState(initialSplit);
  const leftWidth = Math.floor((stdout.columns * splitPercent) / 100);

  return (
    <Box width={stdout.columns} height={stdout.rows} flexDirection="row">
      {/* Left pane */}
      <Box width={leftWidth} borderStyle="single" borderRight={false}>
        {left}
      </Box>

      {/* Resizer */}
      <Box width={1} backgroundColor="gray">
        <Text color="white">│</Text>
      </Box>

      {/* Right pane */}
      <Box flexGrow={1} borderStyle="single" borderLeft={false}>
        {right}
      </Box>
    </Box>
  );
}

// Usage
<SplitPane
  left={
    <Box padding={1}>
      <Text bold>File Tree</Text>
      <Text>src/</Text>
      <Text> components/</Text>
      <Text> utils/</Text>
      <Text>dist/</Text>
    </Box>
  }
  right={
    <Box padding={1}>
      <Text bold>File Content</Text>
      <Text>// Code here...</Text>
    </Box>
  }
/>;
```

## Responsive Grid

```tsx
import React from "react";
import { Box, Text, useStdout } from "ink";

function ResponsiveGrid({ children }: { children: React.ReactNode[] }) {
  const { stdout } = useStdout();
  const columns = stdout.columns > 120 ? 4 : stdout.columns > 80 ? 3 : 2;
  const rows = Math.ceil(children.length / columns);

  return (
    <Box flexDirection="column" gap={1}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} flexDirection="row" gap={1}>
          {children
            .slice(rowIndex * columns, (rowIndex + 1) * columns)
            .map((child, colIndex) => (
              <Box key={colIndex} width={`${100 / columns}%`}>
                {child}
              </Box>
            ))}
        </Box>
      ))}
    </Box>
  );
}

// Usage
<ResponsiveGrid>
  <Card title="Card 1" content="Content 1" />
  <Card title="Card 2" content="Content 2" />
  <Card title="Card 3" content="Content 3" />
  <Card title="Card 4" content="Content 4" />
  <Card title="Card 5" content="Content 5" />
  <Card title="Card 6" content="Content 6" />
</ResponsiveGrid>;

function Card({ title, content }: { title: string; content: string }) {
  return (
    <Box borderStyle="single" padding={1} height={10}>
      <Box flexDirection="column">
        <Text bold>{title}</Text>
        <Newline />
        <Text>{content}</Text>
      </Box>
    </Box>
  );
}
```

## Terminal Size Handling

```tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useStdout } from "ink";

function ResponsiveApp() {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns,
    rows: stdout.rows,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        columns: stdout.columns,
        rows: stdout.rows,
      });
    };

    stdout.on("resize", handleResize);
    return () => stdout.off("resize", handleResize);
  }, [stdout]);

  const isWide = dimensions.columns > 100;
  const isTall = dimensions.rows > 30;

  return (
    <Box flexDirection="column">
      <Text>
        Terminal: {dimensions.columns}x{dimensions.rows}
      </Text>
      <Text>
        Layout: {isWide ? "Wide" : "Narrow"} / {isTall ? "Tall" : "Short"}
      </Text>

      <Box flexDirection={isWide ? "row" : "column"}>
        <Box width={isWide ? "50%" : "100%"}>
          <Text>Panel 1</Text>
        </Box>
        <Box width={isWide ? "50%" : "100%"}>
          <Text>Panel 2</Text>
        </Box>
      </Box>
    </Box>
  );
}
```
