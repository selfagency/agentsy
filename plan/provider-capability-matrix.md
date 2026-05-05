# Provider Capability Matrix

| Provider         | Base Protocol | Tool Call Delta              | Reasoning/Thinking Field     | Strict Schema | Notes                            |
| :--------------- | :------------ | :--------------------------- | :--------------------------- | :------------ | :------------------------------- |
| **DeepSeek**     | OpenAI        | `tool_calls`/`delta`         | `reasoning_content` (inline) | Yes           | Use `reasoning_content` deltas.  |
| **Kimi**         | OpenAI        | `tool_calls`/`delta`/`index` | N/A                          | Yes           | Strict JSON schema required.     |
| **Qwen**         | OpenAI/Ollama | `tool_calls`/`delta`         | `content` (inline tags)      | Partial       | Handle `<tool_call>` in content. |
| **Llama (Meta)** | OpenAI/Ollama | `tool_calls`/`delta`         | N/A                          | No            | Standard OpenAI-compatible.      |
| **Granite**      | OpenAI        | `tool_calls`/`delta`         | N/A                          | No            | IBM Granite OpenAI-compatible.   |

## Internal Contract Mapping

### StreamChunk Updates

- Ensure `thinking` captures `reasoning_content` (DeepSeek).
- Ensure `nativeToolCallDeltas` captures `index` (Kimi/OpenAI).

### Outbound Adapter Roles

- `system`, `user`, `assistant`, `tool`.
- Use universal part model (text, image, tool-call, tool-result).
