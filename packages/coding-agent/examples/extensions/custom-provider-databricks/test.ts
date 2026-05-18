/**
 * Test script for Databricks extension
 * Run: npx tsx test.ts [model-id]
 *
 * Tests the OpenAI-compatible endpoint directly.
 * Requires DATABRICKS_HOST_URL, DATABRICKS_BASE_PATH, and DATABRICKS_TOKEN env vars.
 */

import OpenAI from "openai";

const host = process.env.DATABRICKS_HOST_URL || "https://example-workspace.cloud.databricks.com";
const basePath = process.env.DATABRICKS_BASE_PATH || "/ai-gateway/mlflow/v1";
const apiKey = process.env.DATABRICKS_TOKEN;

if (!apiKey) {
	console.error("Set DATABRICKS_TOKEN env var");
	process.exit(1);
}

const client = new OpenAI({
	apiKey,
	baseURL: `${host}${basePath}`,
	dangerouslyAllowBrowser: true,
});

async function main() {
	const modelId = process.argv[2] || "databricks-gpt-oss-120b";
	console.log(`Testing model: ${modelId}\n`);

	const stream = await client.chat.completions.create({
		model: modelId,
		messages: [
			{ role: "system", content: "You are a helpful assistant. Be concise." },
			{ role: "user", content: "Say hello in 3 words" },
		],
		stream: true,
		max_tokens: 100,
	});

	for await (const chunk of stream) {
		const content = chunk.choices?.[0]?.delta?.content;
		if (typeof content === "string") {
			process.stdout.write(content);
		} else if (Array.isArray(content)) {
			for (const part of content) {
				if (part.type === "text" && typeof part.text === "string") {
					process.stdout.write(part.text);
				}
			}
		}
	}
	console.log("\n\nDone");
}

main().catch(console.error);
