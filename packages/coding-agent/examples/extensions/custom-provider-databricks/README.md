# Databricks Provider Extension

Provides access to Databricks-hosted LLM models through the Databricks OpenAI-compatible Chat Completions API.

## Prerequisites

- pi installed (`brew install mariozechner/pi/pi` or via npm)
- A Databricks workspace with a serving endpoint or MLflow AI Gateway
- A Databricks PAT token (starts with `dapi...`)

## Setup

Copy the extension directory to your project:

```bash
cp -r packages/coding-agent/examples/extensions/custom-provider-databricks /your/project/
cd /your/project/custom-provider-databricks
npm install
```

## Usage

Set the required environment variables and run pi:

```bash
DATABRICKS_HOST_URL="https://your-workspace.cloud.databricks.com" \
DATABRICKS_BASE_PATH="/ai-gateway/mlflow/v1" \
DATABRICKS_TOKEN="dapi..." \
pi -e /your/project/custom-provider-databricks --model databricks/databricks-gpt-oss-120b
```

### Environment Variables

| Variable | Required | Description | Default |
|---|---|---|---|
| `DATABRICKS_HOST_URL` | Yes | Databricks workspace URL | `https://example-workspace.cloud.databricks.com` |
| `DATABRICKS_BASE_PATH` | Yes | API base path (serving endpoint or gateway) | `/ai-gateway/mlflow/v1` |
| `DATABRICKS_TOKEN` | Yes | Databricks PAT token | — |

The full endpoint URL is constructed as `{DATABRICKS_HOST_URL}{DATABRICKS_BASE_PATH}/chat/completions`.

### Selecting a Model

List available models:

```bash
pi -e /your/project/custom-provider-databricks --list-models databricks
```

Select a model via `--model`:

```bash
pi -e /your/project/custom-provider-databricks --model databricks/databricks-gpt-oss-120b -p "Hello"
```

## Customizing Models

Edit the `MODELS` array in `index.ts` to add or modify models:

```typescript
export const MODELS: DatabricksModel[] = [
    {
        id: "databricks-gpt-oss-120b",
        name: "Databricks GPT OSS 120B",
        baseUrl: `${DATABRICKS_HOST_URL}${DATABRICKS_BASE_PATH}`,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32767,
        maxTokens: 25000,
    },
];
```

Each model requires:
- `id` — model ID sent in the API request body
- `maxTokens` — capped at the Databricks endpoint's `max_output_tokens` limit (25000 for this model)

## Testing

### Standalone test (recommended)

```bash
cd /your/project/custom-provider-databricks
DATABRICKS_HOST_URL="..." DATABRICKS_BASE_PATH="..." DATABRICKS_TOKEN="dapi..." \
    npx tsx test.ts
```

Pass an optional model ID:

```bash
DATABRICKS_TOKEN="dapi..." npx tsx test.ts databricks-gpt-oss-120b
```

### Streaming debug

```bash
DATABRICKS_HOST_URL="..." DATABRICKS_BASE_PATH="..." DATABRICKS_TOKEN="dapi..." \
    npx tsx debug-stream.ts
```

This prints each streaming chunk to stderr so you can inspect the `delta.content` format (reasoning blocks vs text blocks).

## Architecture

The extension uses the OpenAI SDK (`openai` npm package) directly rather than going through pi-ai's built-in OpenAI provider wrappers. This gives full control over the request body format:

- Messages are converted to plain strings (Databricks does not support the structured `content: [{type: "text", ...}]` array format)
- `max_tokens` is capped at 25000 (Databricks enforces this limit)
- Tool definitions and `stream_options` are omitted (not supported)
- Response chunks are parsed for both `string` content and `type: "text"` content parts

## Known Limitations

- OAuth login is not implemented (uses PAT tokens only)
- Tool calls are not supported (the model does not expose function-calling)
- Usage tokens are not tracked (the Databricks response may include usage in chunks, but parsing is not yet implemented)
- The model emits `type: "reasoning"` blocks during streaming — these are silently ignored
