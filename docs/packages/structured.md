# `@agentsy/structured`

- **Status:** Published
- **Role:** JSON parsing, repair, validation, and schema-oriented streaming helpers

## Key exports

- `parseJson`
- `validateJsonSchema`
- `buildFormatInstructions`
- `buildRepairPrompt`
- `streamJson`
- `autoRepair`
- `providerFormats`
- `repairStateMachine`
- `fieldValidator`
- `zodAdapter`

## Available APIs

- JSON parsing and schema validation
- Repair prompt and format-instruction builders
- Streaming JSON helpers and provider-format adapters

## Where it fits

This package handles the part where model output almost looks like structured data but is still trying very hard to disappoint you.

## Common neighbors

- `@agentsy/processor`
- `@agentsy/tool-calls`
- `@agentsy/agent`

## Implementation example with neighbors

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';
import { LLMStreamProcessor } from '@agentsy/processor';
import { parseJson, validateJsonSchema } from '@agentsy/structured';

const processor = new LLMStreamProcessor();

for await (const rawChunk of stream) {
  processor.process(normalizeOpenAIChatChunk(rawChunk));
}

const content = processor.accumulatedMessage.content;
const payload = parseJson(content);
const validated = validateJsonSchema(content, responseSchema);
console.log(validated.success);
```
