/**
 * Test script for Databricks extension
 * Run: npx tsx test.ts [model-id] [--thinking]
 *
 * Examples:
 *   npx tsx test.ts                              # Test default (databricks-dolly-v2-12b)
 *   npx tsx test.ts databricks-mosaic-gpt-neo     # Test Mosaic GPT Neo
 *   npx tsx test.ts databricks-dolly-v2-12b --thinking
 */

import { type Api, type Context, type Model, registerApiProvider, streamSimple } from "@mariozechner/pi-ai";
import { readFileSync } from "fs";
import { getAgentDir } from "packages/coding-agent/src/config.js";
import { join } from "path";
import { MODELS, streamGitLabDuo } from "./index.js";

const MODEL_MAP = new Map(MODELS.map((m) => [m.id, m]));

async function main() {
	const modelId = process.argv[2] || "databricks-dolly-v2-12b";
	const useThinking = process.argv.includes("--thinking");

	const cfg = MODEL_MAP.get(modelId);
	if (!cfg) {
		console.error(`Unknown model: ${modelId}`);
		console.error("Available:", MODELS.map((m) => m.id).join(", "));
		process.exit(1);
	}

	// Read auth
	const authPath = join(getAgentDir(), "extensions", "auth.json");
	const authData = JSON.parse(readFileSync(authPath, "utf-8"));
	const databricksCred = authData["databricks"];
	if (!databricksCred?.access) {
		console.error("No databricks credentials. Run /login databricks first.");
		process.exit(1);
	}

	// Register provider
	registerApiProvider({
		api: "databricks-api" as Api,
		stream: streamDatabricks,
		streamSimple: streamDatabricks,
	});

	// Create model
	const model: Model<Api> = {
		id: cfg.id,
		name: cfg.name,
		api: "databricks-api" as Api,
		provider: "databricks",
		baseUrl: cfg.baseUrl,
		reasoning: cfg.reasoning,
		input: cfg.input,
		cost: cfg.cost,
		contextWindow: cfg.contextWindow,
		maxTokens: cfg.maxTokens,
	};

	const context: Context = {
		messages: [{ role: "user", content: "Say hello in exactly 3 words.", timestamp: Date.now() }],
	};

	console.log(`Model: ${model.id}, Backend: ${cfg.backend}, Thinking: ${useThinking}`);

	const stream = streamSimple(model, context, {
		apiKey: databricksCred.access,
		maxTokens: 100,
		reasoning: useThinking ? "low" : undefined,
	});

	for await (const event of stream) {
		if (event.type === "thinking_start") console.log("[Thinking]");
		else if (event.type === "thinking_delta") process.stdout.write(event.delta);
		else if (event.type === "thinking_end") console.log("\n[/Thinking]\n");
		else if (event.type === "text_delta") process.stdout.write(event.delta);
		else if (event.type === "error") console.error("\nError:", event.error.errorMessage);
		else if (event.type === "done") console.log("\n\nDone!", event.reason, event.message.usage);
	}
}

main().catch(console.error);
