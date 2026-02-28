import OpenAI from "openai";

const kiloKey = process.env.KILO_API_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;
const apiKey = kiloKey || openRouterKey || "sk-no-key-set";

if (!apiKey && process.env.NODE_ENV === "production") {
    console.warn("Neither KILO_API_KEY nor OPENROUTER_API_KEY is set");
}

// Rename this internal instance to 'gateway' but keep the export name
// 'openrouter' for backward compatibility with existing imports.
export const openrouter = new OpenAI({
    baseURL: kiloKey ? "https://api.kilo.ai/api/gateway" : "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Randi Agent Platform",
        "X-OpenRouter-Retries": "3",
    },
    maxRetries: 3,
});

export const DEFAULT_MODEL =
    process.env.KILO_DEFAULT_MODEL || process.env.OPENROUTER_DEFAULT_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

export function isUnmeteredModel(modelId: string): boolean {
    return modelId.endsWith(":free") || modelId.includes("/free");
}

export async function createChatCompletion(options: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming) {
    let lastError: any;
    for (let i = 0; i < 3; i++) {
        try {
            return await openrouter.chat.completions.create(options);
        } catch (error: any) {
            lastError = error;
            // Retry on 503, 429, 502, 504
            const status = error.status || error.statusCode;
            if (status === 503 || status === 429 || status === 502 || status === 504) {
                const wait = Math.pow(2, i) * 1000;
                await new Promise((r) => setTimeout(r, wait));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}
