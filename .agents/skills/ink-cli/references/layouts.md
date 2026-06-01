# Layout Patterns with Ink

Common Flexbox-based layout patterns for terminal UIs.

## Understanding Flexbox in Ink

Ink uses Yoga (Facebook's Flexbox implementation) for layout:

- Every element is a Flexbox container by default
- Flex direction defaults to `column` (unlike CSS which defaults to `row`)
- Terminal dimensions are measured in columns (width) and rows (height)

## Basic Layouts

### Centered Content

Center content both horizontally and vertically.

```tsx
<Box justifyContent="center" alignItems="center" height="100%">
  <Text>Centered</Text>
</Box>
```

For full-screen centering:

```tsx
function CenteredLayout({ children }: { children: React.ReactNode }) {
  const { stdout } = useStdout();

  return (
    <Box
      width={stdout.columns}
      height={stdout.rows}
      justifyContent="center"
      alignItems="center"
    >
      {children}
    </Box>
  );
}
```

### Sidebar Layout

Fixed-width sidebar with flexible main content.

```tsx
<Box flexDirection="row" height="100%">
  <Box width={30} borderStyle="single" padding={1}>
    <Text bold>Menu</Text>
    <Newline />
    <Text>Item 1</Text>
    <Text>Item 2</Text>
    <Text>Item 3</Text>
  </Box>
  <Box flexGrow={1} padding={1}>
    <Text>Main content area</Text>
  </Box>
</Box>
```

### Header/Footer Layout

Fixed header and footer with scrollable content.

```tsx
<Box flexDirection="column" height="100%">
  {/* Header */}
  <Box height={3} borderStyle="single" padding={1}>
    <Text bold>Application Header</Text>
  </Box>

  {/* Content */}
  <Box flexGrow={1} padding={1} overflow="hidden">
    <Text>{content}</Text>
  </Box>

  {/* Footer */}
  <Box height={1} padding={1}>
    <Text dimColor>Status: Ready</Text>
  </Box>
</Box>
```

### Three-Column Layout

Left sidebar, main content, right sidebar.

```tsx
<Box flexDirection="row" height="100%">
  <Box width="20%" borderStyle="single" padding={1}>
    <Text>Left Panel</Text>
  </Box>

  <Box flexGrow={1} padding={2}>
    <Text>Main Content</Text>
  </Box>

  <Box width="25%" borderStyle="single" padding={1}>
    <Text>Right Panel</Text>
  </Box>
</Box>
```

## Grid Patterns

### Two-Column Grid

```tsx
<Box flexDirection="row" gap={2}>
  <Box width="50%">
    <Text>Column 1</Text>
  </Box>
  <Box width="50%">
    <Text>Column 2</Text>
  </Box>
</Box>
```

### Three-Column Grid

```tsx
<Box flexDirection="row" gap={1}>
  {[1, 2, 3].map((i) => (
    <Box key={i} width="33%" borderStyle="single" padding={1}>
      <Text>Column {i}</Text>
    </Box>
  ))}
</Box>
```

### Auto-Fit Grid

Columns automatically size to content.

```tsx
<Box flexDirection="row" flexWrap="wrap" gap={1}>
  {items.map((item) => (
    <Box key={item.id} width={20} borderStyle="round" padding={1}>
      <Text>{item.name}</Text>
    </Box>
  ))}
</Box>
```

## Spacing Patterns

### Push to Edges

Use Spacer to push elements to opposite edges.

```tsx
<Box>
  <Text>Left content</Text>
  <Spacer />
  <Text>Right content</Text>
</Box>
```

### Even Distribution

```tsx
<Box justifyContent="space-between">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
  <Text>Item 3</Text>
</Box>
```

Or with equal spacing around items:

```tsx
<Box justifyContent="space-around">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
  <Text>Item 3</Text>
</Box>
```

### Gap Spacing

Modern approach using gap (similar to CSS Grid/Flexbox gap).

```tsx
<Box flexDirection="column" gap={1}>
  <Text>Item 1</Text>
  <Text>Item 2</Text>
  <Text>Item 3</Text>
</Box>
```

## Card Patterns

### Bordered Card

```tsx
<Box borderStyle="round" borderColor="green" padding={1} width={40}>
  <Text bold>Card Title</Text>
  <Newline />
  <Text>Card content goes here.</Text>
</Box>
```

### Elevated Card (using double border)

```tsx
<Box borderStyle="double" padding={2} width={50}>
  <Text bold color="blue">
    Important Notice
  </Text>
  <Newline />
  <Text>{message}</Text>
</Box>
```

### Card Grid

```tsx
<Box flexDirection="row" flexWrap="wrap" gap={2}>
  {cards.map((card) => (
    <Box key={card.id} width={30} borderStyle="single" padding={1}>
      <Text bold>{card.title}</Text>
      <Newline />
      <Text>{card.description}</Text>
    </Box>
  ))}
</Box>
```

## List Patterns

### Vertical List

```tsx
<Box flexDirection="column">
  {items.map((item, index) => (
    <Box key={item.id} paddingY={1}>
      <Text>
        {index + 1}. {item.name}
      </Text>
    </Box>
  ))}
</Box>
```

### Horizontal List

```tsx
<Box flexDirection="row" gap={2}>
  {tags.map((tag) => (
    <Box key={tag} paddingX={1} borderStyle="round">
      <Text>{tag}</Text>
    </Box>
  ))}
</Box>
```

### Selectable List

```tsx
<Box flexDirection="column">
  {items.map((item, index) => (
    <Box
      key={item.id}
      paddingY={1}
      backgroundColor={selectedIndex === index ? "gray" : undefined}
    >
      <Text bold={selectedIndex === index}>
        {selectedIndex === index ? "> " : "  "}
        {item.name}
      </Text>
    </Box>
  ))}
</Box>
```

## Form Layouts

### Stacked Form

```tsx
<Box flexDirection="column" gap={1} width={50}>
  <Box>
    <Text bold>Name:</Text>
    <Box borderStyle="single" padding={1}>
      <Text>{name || " "}</Text>
    </Box>
  </Box>

  <Box>
    <Text bold>Email:</Text>
    <Box borderStyle="single" padding={1}>
      <Text>{email || " "}</Text>
    </Box>
  </Box>

  <Box>
    <Text color="green">Submit</Text>
  </Box>
</Box>
```

### Inline Form

```tsx
<Box flexDirection="row" gap={2} alignItems="center">
  <Text bold>Filter:</Text>
  <Box borderStyle="single" paddingX={1} width={20}>
    <Text>{filter}</Text>
  </Box>
  <Text dimColor>(Press Enter to apply)</Text>
</Box>
```

## Responsive Patterns

### Conditional Layout Based on Width

```tsx
function ResponsiveLayout() {
  const { stdout } = useStdout();
  const isWide = stdout.columns > 80;

  return (
    <Box flexDirection={isWide ? "row" : "column"}>
      <Box width={isWide ? 30 : "100%"}>
        <Text>Sidebar</Text>
      </Box>
      <Box flexGrow={1}>
        <Text>Main Content</Text>
      </Box>
    </Box>
  );
}
```

### Truncating Content

```tsx
<Box width="100%">
  <Text wrap="truncate">{veryLongText}</Text>
</Box>
```

### Scrollable Area

```tsx
<Box height={20} overflow="hidden">
  <Box flexDirection="column">
    {longList.map((item) => (
      <Text key={item.id}>{item.name}</Text>
    ))}
  </Box>
</Box>
```

## Table Layouts

### Simple Table

```tsx
<Box flexDirection="column">
  {/* Header */}
  <Box flexDirection="row" borderStyle="single" paddingX={1}>
    <Box width={20}>
      <Text bold>Name</Text>
    </Box>
    <Box width={15}>
      <Text bold>Status</Text>
    </Box>
    <Box width={10}>
      <Text bold>Age</Text>
    </Box>
  </Box>

  {/* Rows */}
  {data.map((row) => (
    <Box key={row.id} flexDirection="row" paddingX={1}>
      <Box width={20}>
        <Text>{row.name}</Text>
      </Box>
      <Box width={15}>
        <Text>{row.status}</Text>
      </Box>
      <Box width={10}>
        <Text>{row.age}</Text>
      </Box>
    </Box>
  ))}
</Box>
```

### Table with Borders

```tsx
<Box flexDirection="column" borderStyle="single">
  <Box flexDirection="row" borderBottom>
    <Box width={20} padding={1} borderRight>
      <Text bold>Name</Text>
    </Box>
    <Box width={15} padding={1} borderRight>
      <Text bold>Status</Text>
    </Box>
    <Box width={10} padding={1}>
      <Text bold>Age</Text>
    </Box>
  </Box>

  {data.map((row, index) => (
    <Box
      key={row.id}
      flexDirection="row"
      borderBottom={index < data.length - 1}
    >
      <Box width={20} padding={1} borderRight>
        <Text>{row.name}</Text>
      </Box>
      <Box width={15} padding={1} borderRight>
        <Text>{row.status}</Text>
      </Box>
      <Box width={10} padding={1}>
        <Text>{row.age}</Text>
      </Box>
    </Box>
  ))}
</Box>
```

## Terminal-Aware Layouts

### Full Screen App

```tsx
function FullScreenApp() {
  const { stdout } = useStdout();

  return (
    <Box width={stdout.columns} height={stdout.rows} flexDirection="column">
      {/* App content */}
    </Box>
  );
}
```

### Responsive Padding

```tsx
function ResponsiveContainer({ children }: { children: React.ReactNode }) {
  const { stdout } = useStdout();
  const padding = stdout.columns > 100 ? 4 : stdout.columns > 60 ? 2 : 1;

  return <Box padding={padding}>{children}</Box>;
}
```

## Best Practices

1. **Use percentages for fluid layouts**: `<Box width="50%">` adapts to terminal size
2. **Min/max dimensions**: Set `minWidth`/`maxWidth` to prevent broken layouts
3. **Gap over margins**: Use `gap` property for consistent spacing
4. **Test at different sizes**: Terminal widths vary from 80 to 300+ columns
5. **Consider overflow**: Use `overflow="hidden"` for scrollable areas
6. **Spacer for alignment**: Use `<Spacer />` to push content to edges
7. **FlexGrow for expansion**: Use `flexGrow={1}` for flexible content areas
