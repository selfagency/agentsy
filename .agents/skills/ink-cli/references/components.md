# Ink Components

Built-in components for building terminal UIs with Ink.

## Text

Display text with styling options.

```tsx
import {Text} from 'ink';

<Text>Hello World</Text>
<Text color="green">Green text</Text>
<Text backgroundColor="white" color="black">White background</Text>
<Text bold>Bold text</Text>
<Text italic>Italic text</Text>
<Text underline>Underlined text</Text>
<Text strikethrough>Strikethrough</Text>
<Text dimColor>Dimmed text</Text>
<Text inverse>Inverted colors</Text>
```

### Props

| Prop              | Type                                                                     | Description                            |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| `color`           | `string`                                                                 | Text color (CSS color names, hex, rgb) |
| `backgroundColor` | `string`                                                                 | Background color                       |
| `bold`            | `boolean`                                                                | Bold text                              |
| `italic`          | `boolean`                                                                | Italic text                            |
| `underline`       | `boolean`                                                                | Underlined text                        |
| `strikethrough`   | `boolean`                                                                | Strikethrough text                     |
| `dimColor`        | `boolean`                                                                | Dimmed text color                      |
| `inverse`         | `boolean`                                                                | Swap foreground/background colors      |
| `wrap`            | `"wrap" \| "end" \| "truncate" \| "truncate-start" \| "truncate-middle"` | Text wrapping behavior                 |

### Color Values

- CSS names: `"red"`, `"green"`, `"blue"`, etc.
- Hex: `"#ff0000"`, `"#00ff00"`
- RGB: `"rgb(255, 0, 0)"`
- ANSI 256: `196` (number)
- ANSI 16: `"black"`, `"red"`, `"green"`, `"yellow"`, `"blue"`, `"magenta"`, `"cyan"`, `"white"`, `"gray"` or `"grey"`

### Text Wrapping

```tsx
{
  /* Default - wrap at terminal width */
}
<Text>Long text that wraps automatically</Text>;

{
  /* Truncate with ellipsis */
}
<Text wrap="truncate">Very long text...</Text>;

{
  /* Truncate at start */
}
<Text wrap="truncate-start">...end of long text</Text>;

{
  /* Truncate in middle */
}
<Text wrap="truncate-middle">Start...end</Text>;

{
  /* Truncate at end */
}
<Text wrap="end">Text with no ellipsis</Text>;
```

## Box

Container component using Flexbox layout. Similar to `<div>` in the browser.

```tsx
import { Box, Text } from "ink";

<Box>
  <Text>Content</Text>
</Box>;
```

### Layout Props

| Prop             | Type                                                                          | Description          |
| ---------------- | ----------------------------------------------------------------------------- | -------------------- |
| `flexDirection`  | `"row" \| "row-reverse" \| "column" \| "column-reverse"`                      | Flex direction       |
| `justifyContent` | `"flex-start" \| "flex-end" \| "center" \| "space-between" \| "space-around"` | Main axis alignment  |
| `alignItems`     | `"flex-start" \| "flex-end" \| "center" \| "stretch"`                         | Cross axis alignment |
| `alignSelf`      | `"flex-start" \| "flex-end" \| "center" \| "stretch"`                         | Override alignItems  |
| `flexWrap`       | `"nowrap" \| "wrap" \| "wrap-reverse"`                                        | Wrap content         |

### Dimension Props

| Prop        | Type                         | Description                    |
| ----------- | ---------------------------- | ------------------------------ |
| `width`     | `number \| string \| "100%"` | Width in columns or percentage |
| `height`    | `number \| string \| "100%"` | Height in rows or percentage   |
| `minWidth`  | `number`                     | Minimum width                  |
| `maxWidth`  | `number`                     | Maximum width                  |
| `minHeight` | `number`                     | Minimum height                 |
| `maxHeight` | `number`                     | Maximum height                 |

### Spacing Props

| Prop            | Type     | Description          |
| --------------- | -------- | -------------------- |
| `margin`        | `number` | Margin on all sides  |
| `marginX`       | `number` | Horizontal margin    |
| `marginY`       | `number` | Vertical margin      |
| `marginTop`     | `number` | Top margin           |
| `marginBottom`  | `number` | Bottom margin        |
| `marginLeft`    | `number` | Left margin          |
| `marginRight`   | `number` | Right margin         |
| `padding`       | `number` | Padding on all sides |
| `paddingX`      | `number` | Horizontal padding   |
| `paddingY`      | `number` | Vertical padding     |
| `paddingTop`    | `number` | Top padding          |
| `paddingBottom` | `number` | Bottom padding       |
| `paddingLeft`   | `number` | Left padding         |
| `paddingRight`  | `number` | Right padding        |

### Flex Props

| Prop         | Type               | Description          |
| ------------ | ------------------ | -------------------- |
| `flexGrow`   | `number`           | Grow factor          |
| `flexShrink` | `number`           | Shrink factor        |
| `flexBasis`  | `number \| string` | Base size            |
| `gap`        | `number`           | Gap between children |
| `rowGap`     | `number`           | Row gap              |
| `columnGap`  | `number`           | Column gap           |

### Border Props

| Prop           | Type                                                                                         | Description        |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------ |
| `borderStyle`  | `"single" \| "double" \| "round" \| "bold" \| "singleDouble" \| "doubleSingle" \| "classic"` | Border style       |
| `borderColor`  | `string`                                                                                     | Border color       |
| `borderTop`    | `boolean`                                                                                    | Show top border    |
| `borderBottom` | `boolean`                                                                                    | Show bottom border |
| `borderLeft`   | `boolean`                                                                                    | Show left border   |
| `borderRight`  | `boolean`                                                                                    | Show right border  |

### Overflow Props

| Prop        | Type                    | Description         |
| ----------- | ----------------------- | ------------------- |
| `overflow`  | `"visible" \| "hidden"` | Overflow behavior   |
| `overflowX` | `"visible" \| "hidden"` | Horizontal overflow |
| `overflowY` | `"visible" \| "hidden"` | Vertical overflow   |

### Box Examples

```tsx
{
  /* Centered content */
}
<Box justifyContent="center" alignItems="center" height="100%">
  <Text>Centered</Text>
</Box>;

{
  /* Sidebar layout */
}
<Box flexDirection="row" height="100%">
  <Box width={20} borderStyle="single">
    <Text>Sidebar</Text>
  </Box>
  <Box flexGrow={1}>
    <Text>Main content</Text>
  </Box>
</Box>;

{
  /* Grid-like layout */
}
<Box flexDirection="row" gap={2}>
  <Box width="50%">
    <Text>Left</Text>
  </Box>
  <Box width="50%">
    <Text>Right</Text>
  </Box>
</Box>;

{
  /* Bordered box with padding */
}
<Box borderStyle="round" borderColor="green" padding={1}>
  <Text>Content with border</Text>
</Box>;

{
  /* Scrollable area */
}
<Box height={10} overflow="hidden">
  <Text>{longContent}</Text>
</Box>;
```

## Spacer

Fill available space in a Flexbox container.

```tsx
import { Box, Spacer, Text } from "ink";

<Box>
  <Text>Left</Text>
  <Spacer />
  <Text>Right (pushed to edge)</Text>
</Box>;
```

`Spacer` expands to fill all available space, pushing other elements to the edges.

## Static

Render content only once. Useful for logs or output that shouldn't re-render.

```tsx
import { Static, Text } from "ink";
import { useState, useEffect } from "react";

function LogOutput() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Add logs over time
    const interval = setInterval(() => {
      setLogs((prev) => [...prev, `Log entry ${prev.length + 1}`]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <Static items={logs}>{(log) => <Text key={log}>{log}</Text>}</Static>;
}
```

### Props

| Prop       | Type                     | Description                   |
| ---------- | ------------------------ | ----------------------------- |
| `items`    | `T[]`                    | Array of items to render      |
| `children` | `(item: T) => ReactNode` | Render function for each item |

`Static` renders items once and doesn't update them, improving performance for append-only content like logs.

## Newline

Add line breaks.

```tsx
import { Newline, Text } from "ink";

<Text>
  Line 1
  <Newline />
  Line 2
  <Newline count={2} />
  Line 3 (with extra spacing)
</Text>;
```

### Props

| Prop    | Type     | Default | Description                  |
| ------- | -------- | ------- | ---------------------------- |
| `count` | `number` | `1`     | Number of newlines to insert |

## Fragment

React Fragment works as expected for grouping elements without adding layout:

```tsx
<>
  <Text>Line 1</Text>
  <Text>Line 2</Text>
</>
```

Or use the explicit `Fragment` import:

```tsx
import { Fragment } from "react";

<Fragment>
  <Text>Line 1</Text>
  <Text>Line 2</Text>
</Fragment>;
```
