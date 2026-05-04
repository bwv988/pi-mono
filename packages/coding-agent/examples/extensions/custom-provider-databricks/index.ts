/**
 * Databricks Provider Extension
 *
 * Provides access to Databricks-hosted LLM models through the Databricks API.
 * Assumes OpenAI-compatible API (uses pi-ai's built-in OpenAI streaming implementation).
 *
 * Usage:
 *   pi -e ./packages/coding-agent/examples/extensions/custom-provider-databricks
 *   # Then /login databricks, or set DATABRICKS_TOKEN=databricks-...
 */

import {
	type Api,
	type AssistantMessageEventStream,
	type Context,
	createAssistantMessageEventStream,
	type Model,
	type OAuthCredentials,
	type OAuthLoginCallbacks,
	type SimpleStreamOptions,
	streamSimpleAnthropic,
	streamSimpleOpenAIResponses,
} from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// =============================================================================
// Constants
// =============================================================================

const DATABRICKS_HOST_URL = "https://example-workspace.cloud.databricks.com";
// Databricks uses standard OpenAI-compatible endpoints
const OPENAI_COMPATIBLE_URL = `${DATABRICKS_HOST_URL}/api/2.1/engines/chat/completions`;
// For token-based access, Databricks typically uses OAuth tokens
const DATABRICKS_TOKEN_URL = `${DATABRICKS_HOST_URL}/api/2.1/token-generation/create`;

// Databricks typically uses OAuth 2.0 with a client application
// The exact client ID depends on how the Databricks workspace is configured
const CLIENT_ID = "databricks-client-id"; // Replace with actual client ID
const OAUTH_SCOPES = ["openid", "profile", "email", "https://www.googleapis.com/auth/cloud-platform"];
const REDIRECT_URI = "http://127.0.0.1:8080/callback";
const ACCESS_TOKEN_TTL = 60 * 60 * 1000; // 1 hour

// =============================================================================
// Models - exported for use by tests
// =============================================================================

type Backend = "openai"; // Databricks uses OpenAI-compatible API

interface DatabricksModel {
	id: string;
	name: string;
	backend: Backend;
	baseUrl: string;
	reasoning: boolean;
	input: ("text" | "image")[];
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextWindow: number;
	maxTokens: number;
}

export const MODELS: DatabricksModel[] = [
	// Example Databricks models - these are placeholders
	// Replace with actual Databricks model IDs from your workspace
	{
		id: "databricks-gpt-oss-20b",
		name: "Databricks GPT OSS 20B",
		backend: "openai",
		baseUrl: OPENAI_COMPATIBLE_URL,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 32767,
		maxTokens: 65534,
	},	
	// Add more Databricks models here as needed
];

const MODEL_MAP = new Map(MODELS.map((m) => [m.id, m]));
const BUNDLED_CLIENT_ID = "databricks-client-id"; // Replace with actual client ID

// =============================================================================
// Direct Access Token Cache
// =============================================================================

interface CachedAccessToken {
	token: string;
	expiresAt: number;
}

let cachedAccessToken: CachedAccessToken | null = null;

/**
 * Get cached or fetch a fresh access token from Databricks.
 * 
 * Note: Databricks token generation API varies by workspace configuration.
 * This is a placeholder implementation - customize based on your Databricks setup.
 * 
 * Common approaches:
 * 1. Use OAuth token from /login
 * 2. Generate a token via Databricks token API
 * 3. Use existing access token if workspace allows
 */
async function getAccessToken(databricksAccessToken: string): Promise<CachedAccessToken> {
	const now = Date.now();
	if (cachedAccessToken && cachedAccessToken.expiresAt > now) {
		return cachedAccessToken;
	}

	// TODO: Implement token generation/fetching for your Databricks workspace
	// Options:
	// 1. Use the access token directly if workspace allows
	// 2. Call Databricks token generation API
	// 3. Return cached token if using OAuth
	
	// Placeholder: returning the input token (customize based on your setup)
	cachedAccessToken = {
		token: databricksAccessToken,
		expiresAt: now + ACCESS_TOKEN_TTL,
	};
	return cachedAccessToken;
}

function invalidateAccessToken() {
	cachedAccessToken = null;
}

// =============================================================================
// OAuth
// =============================================================================

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	const verifier = btoa(String.fromCharCode(...array))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return { verifier, challenge };
}

/**
 * Login to Databricks via OAuth.
 * 
 * Note: OAuth configuration depends on your Databricks workspace setup.
 * The client_id, scopes, and redirect_uri must match your Databricks OAuth configuration.
 */
async function loginDatabricks(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
	const { verifier, challenge } = await generatePKCE();

	const authParams = new URLSearchParams({
		client_id: BUNDLED_CLIENT_ID,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: OAUTH_SCOPES.join(" "),
		code_challenge: challenge,
		code_challenge_method: "S256",
		state: crypto.randomUUID(),
	});

	callbacks.onAuth({ url: `${DATABRICKS_HOST_URL}/oauth/authorize?${authParams.toString()}` });

	const callbackUrl = await callbacks.onPrompt({ message: "Paste the callback URL:" });
	const code = new URL(callbackUrl).searchParams.get("code");
	if (!code) throw new Error("No authorization code found in callback URL");

	// TODO: Exchange code for tokens via Databricks token endpoint
	// This requires knowledge of your Databricks OAuth configuration
	throw new Error("Databricks OAuth implementation requires configuration. See code for details.");
}

/**
 * Refresh the access token.
 * 
 * Note: Token refresh depends on your Databricks OAuth configuration.
 */
async function refreshDatabricksToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
	// TODO: Implement token refresh for your Databricks OAuth setup
	// Common approach: call Databricks token refresh endpoint with refresh_token
	throw new Error("Databricks token refresh implementation requires configuration. See code for details.");
}

async function loginGitLab(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
	const { verifier, challenge } = await generatePKCE();
	const authParams = new URLSearchParams({
		client_id: BUNDLED_CLIENT_ID,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: OAUTH_SCOPES.join(" "),
		code_challenge: challenge,
		code_challenge_method: "S256",
		state: crypto.randomUUID(),
	});

	callbacks.onAuth({ url: `${GITLAB_COM_URL}/oauth/authorize?${authParams.toString()}` });
	const callbackUrl = await callbacks.onPrompt({ message: "Paste the callback URL:" });
	const code = new URL(callbackUrl).searchParams.get("code");
	if (!code) throw new Error("No authorization code found in callback URL");

	const tokenResponse = await fetch(`${GITLAB_COM_URL}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: BUNDLED_CLIENT_ID,
			grant_type: "authorization_code",
			code,
			code_verifier: verifier,
			redirect_uri: REDIRECT_URI,
		}).toString(),
	});

	if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
	const data = (await tokenResponse.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		created_at: number;
	};
	invalidateDirectAccessToken();
	return {
		refresh: data.refresh_token,
		access: data.access_token,
		expires: (data.created_at + data.expires_in) * 1000 - 5 * 60 * 1000,
	};
}

async function refreshGitLabToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
	const response = await fetch(`${GITLAB_COM_URL}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: BUNDLED_CLIENT_ID,
			grant_type: "refresh_token",
			refresh_token: credentials.refresh,
		}).toString(),
	});
	if (!response.ok) throw new Error(`Token refresh failed: ${await response.text()}`);
	const data = (await response.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		created_at: number;
	};
	invalidateDirectAccessToken();
	return {
		refresh: data.refresh_token,
		access: data.access_token,
		expires: (data.created_at + data.expires_in) * 1000 - 5 * 60 * 1000,
	};
}

// =============================================================================
// Stream Function
// =============================================================================

export function streamDatabricks(
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();

	(async () => {
		try {
			const databricksAccessToken = options?.apiKey;
			if (!databricksAccessToken) throw new Error("No Databricks access token. Run /login databricks or set DATABRICKS_TOKEN");

			const cfg = MODEL_MAP.get(model.id);
			if (!cfg) throw new Error(`Unknown model: ${model.id}`);

			const cachedToken = await getAccessToken(databricksAccessToken);
			const modelWithBaseUrl = { ...model, baseUrl: cfg.baseUrl };
			const headers = {
				Authorization: `Bearer ${cachedToken.token}`,
				"Content-Type": "application/json",
			};
			const streamOptions = { ...options, apiKey: "databricks", headers };

			// Databricks uses OpenAI-compatible API
			const innerStream = streamSimpleOpenAIResponses(
				modelWithBaseUrl as Model<"openai-responses">,
				context,
				streamOptions,
			);

			for await (const event of innerStream) stream.push(event);
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

// =============================================================================
// Extension Entry Point
// =============================================================================

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
		oauth: {
			name: "Databricks",
			login: loginDatabricks,
			refreshToken: refreshDatabricksToken,
			getApiKey: (cred) => cred.access,
		},
		streamSimple: streamDatabricks,
	});
}
