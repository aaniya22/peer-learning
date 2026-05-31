import { budgetResponseTokens, callOpenRouterChatCompletion } from "../utils/openRouter.js";

const ASK_AI_MODEL = "openai/gpt-4o-mini";
const SUMMARY_MODEL = "openai/gpt-4o-mini";
const ASK_AI_MAX_TOKENS = 256;
const SUMMARY_MAX_TOKENS = 320;

const parseSummaryContent = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    return {
      summary: content,
      key_takeaways: [],
    };
  }
};

export const askAI = async (req, res, next) => {
  try {
    const { question } = req.body;
    const answer = await callOpenRouterChatCompletion({
      operation: "ask_ai",
      model: ASK_AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an AI peer mentor for students. Answer questions about coding, AI, DSA, and roadmaps in a supportive, clear, and approachable way.",
        },
        {
          role: "user",
          content: question,
        },
      ],
      maxTokens: budgetResponseTokens(question.length, ASK_AI_MAX_TOKENS),
      temperature: 0.3,
    });

    res.json({
      answer,
    });
  } catch (error) {
    next(error);
  }
};

export const generateSessionSummary = async (req, res, next) => {
  try {
    const { messages } = req.body;

    // Limit to the last 100 messages to prevent excessive token usage
    const recentMessages = messages.slice(-100);

    let conversationText = recentMessages
      .map((msg) => `${msg.username || "User"}: ${msg.message}`)
      .join("\n");

    // Hard limit on character count (approx 5000 tokens max)
    if (conversationText.length > 20000) {
      conversationText = conversationText.slice(-20000);
    }

    const content = await callOpenRouterChatCompletion({
      operation: "generate_session_summary",
      model: SUMMARY_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an AI learning assistant. Generate a concise learning session summary and key takeaways from the conversation. Respond ONLY in valid JSON format like: {\"summary\":\"...\",\"key_takeaways\":[\"...\",\"...\"]}",
        },
        {
          role: "user",
          content: conversationText,
        },
      ],
      maxTokens: budgetResponseTokens(conversationText.length, SUMMARY_MAX_TOKENS),
      temperature: 0.2,
    });

    const parsed = parseSummaryContent(content);

    res.json(parsed);
  } catch (error) {
    next(error);
  }
};
