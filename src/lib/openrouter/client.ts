import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY || "sk-no-key-set";

if (!process.env.OPENROUTER_API_KEY && process.env.NODE_ENV === "production") {
    console.warn("OPENROUTER_API_KEY is not set in environment variables");
}

export const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Randi Agent Platform",
        "X-OpenRouter-Retries": "3", // Ask OpenRouter itself to retry
    },
    maxRetries: 3, // Enable OpenAI client retries
});

export const DEFAULT_MODEL =
    process.env.OPENROUTER_DEFAULT_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

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
