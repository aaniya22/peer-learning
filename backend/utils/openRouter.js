import { HttpError } from "./httpError.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 12000;

export const budgetResponseTokens = (promptSize, ceiling = 256, floor = 64) => {
  const reduction = Math.ceil(promptSize / 120);
  return Math.max(floor, Math.min(ceiling, ceiling - reduction));
};

const createFallbackError = (operation, message, reason) =>
  new HttpError(503, message, {
    retryable: true,
    suggestion: "Please try again in a moment.",
    reason,
    operation,
  });

export const callOpenRouterChatCompletion = async ({
  operation,
  model,
  messages,
  maxTokens,
  temperature,
  timeoutMs = DEFAULT_OPENROUTER_TIMEOUT_MS,
}) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw createFallbackError(operation, "AI service temporarily unavailable. Please try again later.", "missing_api_key");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw createFallbackError(
        operation,
        "AI service temporarily unavailable. Please try again in a moment.",
        `upstream_${response.status}`
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      throw createFallbackError(
        operation,
        "AI service returned an empty response. Please retry your request.",
        "empty_response"
      );
    }

    return content;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw createFallbackError(
        operation,
        "AI request timed out. Please try again.",
        "timeout"
      );
    }

    throw createFallbackError(
      operation,
      "AI service temporarily unavailable. Please try again in a moment.",
      "network_failure"
    );
  } finally {
    clearTimeout(timeoutId);
  }
};
