/**
 * Databricks Provider Extension
 *
 * Provides access to Databricks-hosted LLM models through the Databricks API.
 * Assumes OpenAI-compatible API with Chat Completions endpoint.
 *
 * Usage:
 *   pi -e ./packages/coding-agent/examples/extensions/custom-provider-databricks
 *
 * Environment variables:
 *   DATABRICKS_HOST_URL   - Databricks workspace URL (e.g., https://dbc-xxx.cloud.databricks.com)
 *   DATABRICKS_BASE_PATH  - API base path (e.g., /ai-gateway/mlflow/v1)
 *   DATABRICKS_TOKEN      - Databricks PAT token (starts with dapi...)
 */

import OpenAI from "openai";
import type {
	ChatCompletionCreateParamsStreaming,
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions.js";
import {
	type Api,
	type AssistantMessageEventStream,
	type Context,
	createAssistantMessageEventStream,
	type Model,
	type SimpleStreamOptions,
} from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const DATABRICKS_HOST_URL =
	process.env.DATABRICKS_HOST_URL || "https://example-workspace.cloud.databricks.com";
const DATABRICKS_BASE_PATH =
	process.env.DATABRICKS_BASE_PATH || "/ai-gateway/mlflow/v1";
const OPENAI_COMPATIBLE_URL = `${DATABRICKS_HOST_URL}${DATABRICKS_BASE_PATH}`;
const DATABRICKS_MAX_TOKENS_LIMIT = 25000;

export interface DatabricksModel {
	id: string;
	name: string;
	baseUrl: string;
	reasoning: boolean;
	input: ("text" | "image")[];
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextWindow: number;
	maxTokens: number;
}

export const MODELS: DatabricksModel[] = [
	{
		id: "databricks-gpt-oss-120b",
		name: "Databricks GPT OSS 120B",
		baseUrl: OPENAI_COMPATIBLE_URL,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 32767,
		maxTokens: DATABRICKS_MAX_TOKENS_LIMIT,
	},
];

const MODEL_MAP = new Map(MODELS.map((m) => [m.id, m]));

function flattenContent(msg: { role: string; content?: string | { type: string; text?: string }[] }): string {
	if (typeof msg.content === "string") return msg.content;
	if (Array.isArray(msg.content)) {
		return msg.content
			.map((part) => (part.type === "text" ? part.text || "" : ""))
			.filter(Boolean)
			.join("\n");
	}
	return "";
}

function toOpenAIMessages(context: Context): ChatCompletionMessageParam[] {
	const messages: ChatCompletionMessageParam[] = [];

	if (context.systemPrompt) {
		messages.push({ role: "system", content: context.systemPrompt });
	}

	for (const msg of context.messages) {
		if (msg.role === "user") {
			messages.push({
				role: "user",
				content: flattenContent(msg as any),
			});
		} else if (msg.role === "assistant") {
			const textParts = ((msg as any).content || []).filter(
				(b: any) => b.type === "text",
			);
			messages.push({
				role: "assistant",
				content: textParts.map((b: any) => b.text).join("") || null,
			} as ChatCompletionMessageParam);
		} else if (msg.role === "toolResult" || msg.role === "tool") {
			const toolMsg = msg as any;
			messages.push({
				role: "tool",
				tool_call_id: toolMsg.toolCallId || "",
				content: flattenContent(toolMsg),
			});
		}
	}

	return messages;
}

function extractTextDelta(delta: unknown): string {
	if (typeof delta === "string") return delta;
	if (Array.isArray(delta)) {
		return delta
			.filter((part: any) => part.type === "text" && typeof part.text === "string")
			.map((part: any) => part.text)
			.join("");
	}
	return "";
}

export function streamDatabricks(
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();

	(async () => {
		try {
			const apiKey = options?.apiKey;
			if (!apiKey) {
				throw new Error("No Databricks access token. Run /login databricks or set DATABRICKS_TOKEN");
			}

			const cfg = MODEL_MAP.get(model.id);
			if (!cfg) throw new Error(`Unknown model: ${model.id}`);

			const client = new OpenAI({
				apiKey,
				baseURL: cfg.baseUrl,
				dangerouslyAllowBrowser: true,
			});

			const params: ChatCompletionCreateParamsStreaming = {
				model: model.id,
				messages: toOpenAIMessages(context),
				stream: true,
				max_tokens: options?.maxTokens
					? Math.min(options.maxTokens, DATABRICKS_MAX_TOKENS_LIMIT)
					: DATABRICKS_MAX_TOKENS_LIMIT,
			};
			if (options?.temperature !== undefined) {
				params.temperature = options.temperature;
			}

			const openaiStream = await client.chat.completions.create(params);

			stream.push({
				type: "start",
				partial: {
					role: "assistant",
					content: [],
					api: model.api,
					provider: model.provider,
					model: model.id,
				} as any,
			});

			let fullText = "";

			for await (const chunk of openaiStream) {
				const choice = chunk.choices?.[0];
				if (choice?.delta?.content) {
					const text = extractTextDelta(choice.delta.content);
					if (text) {
						fullText += text;
						stream.push({ type: "text_delta", delta: text });
					}
				}
			}

			if (fullText) {
				stream.push({ type: "text_end", contentIndex: 0, content: fullText, partial: undefined as any });
			}

			stream.push({
				type: "done",
				reason: "stop",
				message: {
					role: "assistant",
					content: fullText ? [{ type: "text", text: fullText }] : [],
					api: model.api,
					provider: model.provider,
					model: model.id,
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "stop",
					timestamp: Date.now(),
				},
			});
			stream.end();
		} catch (error) {
			stream.push({
				type: "error",
				reason: "error",
				error: {
					role: "assistant",
					content: [],
					api: model.api,
					provider: model.provider,
					model: model.id,
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "error",
					errorMessage: error instanceof Error ? error.message : String(error),
					timestamp: Date.now(),
				},
			});
			stream.end();
		}
	})();

	return stream;
}

export default function (pi: ExtensionAPI) {
	pi.registerProvider("databricks", {
		baseUrl: DATABRICKS_HOST_URL,
		apiKey: "DATABRICKS_TOKEN",
		api: "databricks-api",
		models: MODELS.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) => ({
			id,
			name,
			reasoning,
			input,
			cost,
			contextWindow,
			maxTokens,
		})),
		streamSimple: streamDatabricks,
	});
}
