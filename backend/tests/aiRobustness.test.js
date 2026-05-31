import express from "express";
import request from "supertest";
import { vi, describe, it, expect, afterEach } from "vitest";
import { askAI } from "../controllers/aiController.js";
import { createRateLimiter } from "../middlewares/rateLimiter.js";
import { errorHandler } from "../middlewares/errorHandler.js";
import { validate } from "../middlewares/validate.js";
import { aiSchemas } from "../validation/schemas.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("AI route robustness", () => {
  it("returns a fallback 503 when the model call aborts", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));

    const app = express();
    app.use(express.json());
    app.post("/ask", validate(aiSchemas.askAI), askAI);
    app.use(errorHandler);

    const response = await request(app).post("/ask").send({ question: "Explain closures" });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      statusCode: 503,
      message: "AI request timed out. Please try again.",
    });
    expect(response.body.details).toMatchObject({
      retryable: true,
      reason: "timeout",
    });
  });

  it("rate limits by user id before ip and returns a consistent 429 payload", async () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 1,
      keyPrefix: "ai-test",
      message: "Too many AI requests. Please wait before trying again.",
    });

    const app = express();
    app.use((req, res, next) => {
      req.user = { id: req.get("x-test-user") };
      next();
    });
    app.get("/ai", limiter, (req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);

    const first = await request(app)
      .get("/ai")
      .set("x-test-user", "user-1")
      .set("x-forwarded-for", "1.1.1.1");

    expect(first.status).toBe(200);

    const second = await request(app)
      .get("/ai")
      .set("x-test-user", "user-1")
      .set("x-forwarded-for", "2.2.2.2");

    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({
      statusCode: 429,
      message: "Too many AI requests. Please wait before trying again.",
    });
  });
});
