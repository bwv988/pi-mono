# Databricks Provider Extension

Provides access to Databricks-hosted LLM models through the Databricks API.

## Setup

1. Copy the example directory to your workspace:
   ```bash
   cp -r packages/coding-agent/examples/extensions/custom-provider-databricks /your/workspace/
   ```

2. Edit `index.ts` to configure for your Databricks workspace:
   - Set `DATABRICKS_HOST_URL` to your Databricks workspace URL (e.g., `https://your-workspace.cloud.databricks.com`)
   - Update `CLIENT_ID` with your Databricks OAuth client ID
   - Add your Databricks models to the `MODELS` array with correct model IDs and pricing
   - Implement proper token generation/fetching in `getAccessToken()` based on your setup

3. Run pi with the extension:
   ```bash
   pi -e /your/workspace/custom-provider-databricks
   ```

## Usage

- Login via OAuth: `/login databricks`
- Or use API key: `DATABRICKS_TOKEN=databricks-... pi`
- Select model: `/model databricks/<model-id>`

## Notes

- This extension assumes Databricks follows the OpenAI spec (uses `streamSimpleOpenAIResponses`)
- Token generation varies by Databricks workspace configuration
- Customization required for your specific workspace setup